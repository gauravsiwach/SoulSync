from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
security = HTTPBearer()
settings = get_settings()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user ID"""
    try:
        token = credentials.credentials
        logger.info("jwt_token_verification_started", token_length=len(token))
        
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
        
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None:
            logger.error("jwt_token_invalid_no_subject")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        logger.info("jwt_token_verified", user_id=user_id, email=email)
        
        return {
            "user_id": user_id,
            "email": email
        }
        
    except JWTError as e:
        logger.error("jwt_token_verification_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
