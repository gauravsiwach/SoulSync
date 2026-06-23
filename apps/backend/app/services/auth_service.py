import os
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
# Remove GoogleOAuth2 import - we'll use direct HTTP calls instead
import httpx
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.database import get_db
from app.models.user import User

settings = get_settings()
logger = get_logger(__name__)

class AuthService:
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.secret_key = settings.JWT_SECRET or secrets.token_urlsafe(32)
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
        
        # Google OAuth setup (using direct HTTP calls)
        self.google_client_id = settings.GOOGLE_CLIENT_ID
        self.google_client_secret = settings.GOOGLE_CLIENT_SECRET
        self.google_redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return self.pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None
    
    async def authenticate_google_user(self, code: str) -> Optional[Dict[str, Any]]:
        """Authenticate user with Google OAuth"""
        try:
            logger.info("google_auth_started", code_length=len(code))
            
            # Exchange code for access token
            token_url = "https://oauth2.googleapis.com/token"
            data = {
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            }
            
            logger.info("google_token_request", 
                client_id=settings.GOOGLE_CLIENT_ID, 
                redirect_uri=settings.GOOGLE_REDIRECT_URI,
                client_secret_length=len(settings.GOOGLE_CLIENT_SECRET),
                client_secret_preview=settings.GOOGLE_CLIENT_SECRET[:10] + "..." if len(settings.GOOGLE_CLIENT_SECRET) > 10 else settings.GOOGLE_CLIENT_SECRET
            )
            
            async with httpx.AsyncClient() as client:
                token_response = await client.post(token_url, data=data)
                logger.info("google_token_response", status=token_response.status_code)
                
                if token_response.status_code != 200:
                    logger.error("google_token_http_error", status=token_response.status_code, text=token_response.text)
                    return None
                
                token_data = token_response.json()
                logger.info("google_token_data", keys=list(token_data.keys()))
                
                if "access_token" not in token_data:
                    logger.error("google_token_failed", response=token_data)
                    return None
                
                access_token = token_data["access_token"]
                logger.info("google_access_token_received", token_length=len(access_token))
                
                # Get user info from Google
                user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
                headers = {"Authorization": f"Bearer {access_token}"}
                
                user_response = await client.get(user_info_url, headers=headers)
                logger.info("google_user_info_response", status=user_response.status_code)
                
                if user_response.status_code != 200:
                    logger.error("google_user_info_error", status=user_response.status_code, text=user_response.text)
                    return None
                
                user_info = user_response.json()
                logger.info("google_user_info_retrieved", email=user_info.get("email"), name=user_info.get("name"))
                
                return {
                    "email": user_info.get("email"),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture"),
                    "provider": "google",
                    "provider_id": user_info.get("id"),
                }
                
        except Exception as e:
            logger.error("google_auth_exception", error=str(e), error_type=type(e).__name__)
            return None
    
    async def get_or_create_user(self, user_data: Dict[str, Any]) -> Optional[User]:
        """Get existing user or create new one"""
        try:
            db = next(get_db())
            
            # Check if user exists
            user = db.query(User).filter(
                (User.email == user_data["email"]) |
                (User.provider_id == user_data.get("provider_id"))
            ).first()
            
            if user:
                logger.info("existing_user_found", user_id=user.id, email=user.email)
                return user
            
            # Create new user
            new_user = User(
                email=user_data["email"],
                display_name=user_data.get("name", ""),
                provider=user_data["provider"],
                provider_id=user_data.get("provider_id"),
                avatar_url=user_data.get("picture"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            logger.info("new_user_created", user_id=new_user.id, email=new_user.email)
            return new_user
            
        except Exception as e:
            logger.error("user_creation_error", error=e)
            return None
    
    async def create_user_session(self, user: User) -> Dict[str, Any]:
        """Create user session with JWT token"""
        access_token_expires = timedelta(minutes=self.access_token_expire_minutes)
        access_token = self.create_access_token(
            data={"sub": str(user.id), "email": user.email},
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": self.access_token_expire_minutes * 60,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "provider": user.provider,
            }
        }

# Global auth service instance
auth_service = AuthService()
