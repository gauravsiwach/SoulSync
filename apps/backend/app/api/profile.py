from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.core.logging import get_logger, log_api_request, log_api_response
from app.db.database import get_db
from app.models.user import User
from app.models.user_profile import UserProfile
import time

logger = get_logger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])

# Pydantic models
class UserProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str | None
    age_range: str | None
    occupation: str | None
    location: str | None
    relationship_status: str | None
    interests: list[str] | None
    ai_profile: dict | None
    created_at: str
    updated_at: str

class UserProfileUpdate(BaseModel):
    name: str | None = None
    age_range: str | None = None
    occupation: str | None = None
    location: str | None = None
    relationship_status: str | None = None
    interests: list[str] | None = None

class OnboardingRequest(BaseModel):
    name: str
    age_range: str
    occupation: str
    location: str | None = None
    relationship_status: str
    interests: list[str] | None = None
    personal_goals: str | None = None
    trusted_contact: dict | None = None

@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile"""
    start_time = time.time()
    log_api_request("GET", "/profile/me", current_user["user_id"])
    
    try:
        # Get user
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get or create user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        
        if not profile:
            # Create empty profile if it doesn't exist
            profile = UserProfile(user_id=user.id)
            db.add(profile)
            db.commit()
            db.refresh(profile)
            logger.info("profile_created", user_id=user.id)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", "/profile/me", 200, duration)
        logger.info("profile_retrieved", user_id=user.id)
        
        return UserProfileResponse(
            id=str(profile.id),
            user_id=str(profile.user_id),
            name=profile.name,
            age_range=profile.age_range,
            occupation=profile.occupation,
            location=profile.location,
            relationship_status=profile.relationship_status,
            interests=profile.interests,
            ai_profile=profile.ai_profile,
            created_at=profile.created_at.isoformat(),
            updated_at=profile.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_profile_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve profile")

@router.put("/me", response_model=UserProfileResponse)
async def update_profile(
    profile_update: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    start_time = time.time()
    log_api_request("PUT", "/profile/me", current_user["user_id"])
    
    try:
        # Get user
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get or create user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        
        if not profile:
            profile = UserProfile(user_id=user.id)
            db.add(profile)
        
        # Update profile fields
        if profile_update.name is not None:
            profile.name = profile_update.name
        if profile_update.age_range is not None:
            profile.age_range = profile_update.age_range
        if profile_update.occupation is not None:
            profile.occupation = profile_update.occupation
        if profile_update.location is not None:
            profile.location = profile_update.location
        if profile_update.relationship_status is not None:
            profile.relationship_status = profile_update.relationship_status
        if profile_update.interests is not None:
            profile.interests = profile_update.interests
        
        db.commit()
        db.refresh(profile)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("PUT", "/profile/me", 200, duration)
        logger.info("profile_updated", user_id=user.id)
        
        return UserProfileResponse(
            id=str(profile.id),
            user_id=str(profile.user_id),
            name=profile.name,
            age_range=profile.age_range,
            occupation=profile.occupation,
            location=profile.location,
            relationship_status=profile.relationship_status,
            interests=profile.interests,
            ai_profile=profile.ai_profile,
            created_at=profile.created_at.isoformat(),
            updated_at=profile.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_profile_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update profile")

@router.post("/onboarding", response_model=UserProfileResponse)
async def complete_onboarding(
    onboarding_data: OnboardingRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete onboarding and create user profile"""
    start_time = time.time()
    log_api_request("POST", "/profile/onboarding", current_user["user_id"])
    
    try:
        # Get user
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if profile already exists
        existing_profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if existing_profile:
            logger.info("profile_already_exists", user_id=user.id)
            # Update existing profile
            profile = existing_profile
        else:
            # Create new profile
            profile = UserProfile(user_id=user.id)
            db.add(profile)
        
        # Update profile with onboarding data
        profile.name = onboarding_data.name
        profile.age_range = onboarding_data.age_range
        profile.occupation = onboarding_data.occupation
        profile.location = onboarding_data.location
        profile.relationship_status = onboarding_data.relationship_status
        profile.interests = onboarding_data.interests
        
        # Store additional data in ai_profile
        ai_profile = profile.ai_profile or {}
        if onboarding_data.personal_goals:
            ai_profile["personal_goals"] = onboarding_data.personal_goals
        if onboarding_data.trusted_contact:
            ai_profile["trusted_contact"] = onboarding_data.trusted_contact
        profile.ai_profile = ai_profile
        
        db.commit()
        db.refresh(profile)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("POST", "/profile/onboarding", 200, duration)
        logger.info("onboarding_completed", user_id=user.id)
        
        return UserProfileResponse(
            id=str(profile.id),
            user_id=str(profile.user_id),
            name=profile.name,
            age_range=profile.age_range,
            occupation=profile.occupation,
            location=profile.location,
            relationship_status=profile.relationship_status,
            interests=profile.interests,
            ai_profile=profile.ai_profile,
            created_at=profile.created_at.isoformat(),
            updated_at=profile.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("onboarding_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to complete onboarding")
