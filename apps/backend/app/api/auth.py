from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from app.services.auth_service import auth_service
from app.core.logging import get_logger, log_api_request, log_api_response
import time
import json

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()

class GoogleAuthRequest(BaseModel):
    code: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: dict

class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str
    provider: str

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = auth_service.verify_token(token)
    
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    # TODO: Get user from database
    # For now, return basic user info from token
    return {
        "id": user_id,
        "email": payload.get("email"),
    }

@router.get("/google")
async def google_auth_login():
    """Get Google OAuth login URL"""
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={auth_service.google_client_id}&"
        f"redirect_uri={auth_service.google_redirect_uri}&"
        "response_type=code&"
        "scope=openid email profile&"
        "access_type=offline"
    )
    
    logger.info("google_auth_url_generated")
    return {"auth_url": google_auth_url}

@router.get("/google/callback")
async def google_auth_callback_get(code: str = None, error: str = None):
    """Handle Google OAuth callback (GET request from browser)"""
    start_time = time.time()
    log_api_request("GET", "/auth/google/callback")
    
    try:
        if error:
            logger.error("google_oauth_error", error=error)
            raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
        
        if not code:
            logger.error("google_oauth_no_code")
            raise HTTPException(status_code=400, detail="No authorization code received")
        
        # Authenticate with Google
        user_data = await auth_service.authenticate_google_user(code)
        
        if not user_data:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Google")
        
        # Get or create user
        from app.models.user import User
        user = await auth_service.get_or_create_user(user_data)
        
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user")
        
        # Create session
        session_data = await auth_service.create_user_session(user)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", "/auth/google/callback", 200, duration)
        
        logger.info("google_auth_success", user_id=user.id, email=user.email)
        
        # Return HTML page that can communicate with mobile app
        html_response = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>SoulSync - Authentication Success</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: #f8fafc;">
            <div style="max-width: 400px; margin: 0 auto;">
                <h1 style="color: #1e293b; margin-bottom: 20px;">✅ Authentication Successful!</h1>
                <p style="color: #64748b; margin-bottom: 30px;">You have been successfully signed in to SoulSync.</p>
                
                <div style="background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="color: #1e293b; margin-bottom: 10px;">User Information</h3>
                    <p style="color: #64748b; margin: 5px 0;"><strong>Name:</strong> {user.display_name}</p>
                    <p style="color: #64748b; margin: 5px 0;"><strong>Email:</strong> {user.email}</p>
                    <p style="color: #64748b; margin: 5px 0;"><strong>Provider:</strong> {user.provider}</p>
                </div>
                
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #0369a1; margin: 0; font-size: 14px;">
                        <strong>Access Token:</strong> {session_data['access_token'][:20]}...
                    </p>
                </div>
                
                <button onclick="window.close()" style="background: #6366f1; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer;">
                    Close Window
                </button>
                
                <script>
                    console.log('[SOULSYNC] OAuth success page loaded');
                    console.log('[SOULSYNC] window.opener exists:', !!window.opener);
                    console.log('[SOULSYNC] window.opener.closed:', window.opener ? window.opener.closed : 'N/A');
                    
                    const token = '{session_data['access_token']}';
                    const user = JSON.parse('{json.dumps(session_data['user'])}');
                    
                    console.log('[SOULSYNC] Token length:', token.length);
                    console.log('[SOULSYNC] User:', user);
                    
                    // Store token in localStorage for mobile app to retrieve
                    localStorage.setItem('soulsync_token', token);
                    localStorage.setItem('soulsync_user', JSON.stringify(user));
                    
                    // Try to communicate with opener window (if opened via window.open)
                    if (window.opener && !window.opener.closed) {{
                        console.log('[SOULSYNC] Posting message to opener window at http://localhost:8082');
                        try {{
                            window.opener.postMessage({{
                                type: 'soulsync_auth_success',
                                token: token,
                                user: user
                            }}, 'http://localhost:8082');
                            console.log('[SOULSYNC] Message posted successfully');
                            
                            // Close this window after sending message
                            setTimeout(() => {{
                                console.log('[SOULSYNC] Closing popup window');
                                window.close();
                            }}, 500);
                        }} catch (error) {{
                            console.error('[SOULSYNC] Error posting message:', error);
                        }}
                    }} else {{
                        console.log('[SOULSYNC] No opener window, redirecting...');
                        // For web browsers, redirect back to the app
                        setTimeout(() => {{
                            window.location.href = 'http://localhost:8082/oauth-callback?token=' + encodeURIComponent(token);
                        }}, 1000);
                    }}
                </script>
            </div>
        </body>
        </html>
        """
        
        return HTMLResponse(
            content=html_response, 
            status_code=200,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("google_auth_callback_error", error=e)
        raise HTTPException(status_code=500, detail="Authentication failed")

@router.post("/google/callback", response_model=AuthResponse)
async def google_auth_callback_post(request: GoogleAuthRequest):
    """Handle Google OAuth callback"""
    start_time = time.time()
    log_api_request("POST", "/auth/google/callback")
    
    try:
        # Authenticate with Google
        user_data = await auth_service.authenticate_google_user(request.code)
        
        if not user_data:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Google")
        
        # Get or create user
        from app.models.user import User
        user = await auth_service.get_or_create_user(user_data)
        
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user")
        
        # Create session
        session_data = await auth_service.create_user_session(user)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("POST", "/auth/google/callback", 200, duration)
        
        logger.info("google_auth_success", user_id=user.id, email=user.email)
        
        return session_data
        
    except Exception as e:
        logger.error("google_auth_callback_error", error=e)
        raise HTTPException(status_code=500, detail="Authentication failed")

@router.get("/profile", response_model=UserProfile)
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    log_api_request("GET", "/profile", current_user.get("id"))
    
    try:
        # TODO: Get full user profile from database
        # For now, return basic profile
        profile = {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": "",  # TODO: Get from database
            "avatar_url": "",  # TODO: Get from database
            "provider": "",  # TODO: Get from database
        }
        
        log_api_response("GET", "/profile", 200, 0)
        return profile
        
    except Exception as e:
        logger.error("get_profile_error", error=e)
        raise HTTPException(status_code=500, detail="Failed to get user profile")

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (invalidate token)"""
    log_api_request("POST", "/logout", current_user.get("id"))
    
    try:
        # TODO: Implement token invalidation (Redis blacklist)
        logger.info("user_logout", user_id=current_user["id"])
        
        log_api_response("POST", "/logout", 200, 0)
        return {"message": "Successfully logged out"}
        
    except Exception as e:
        logger.error("logout_error", error=e)
        raise HTTPException(status_code=500, detail="Logout failed")

@router.get("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Verify JWT token is valid"""
    log_api_request("GET", "/verify", current_user.get("id"))
    
    try:
        log_api_response("GET", "/verify", 200, 0)
        return {"valid": True, "user": current_user}
        
    except Exception as e:
        logger.error("verify_token_error", error=e)
        raise HTTPException(status_code=500, detail="Token verification failed")
