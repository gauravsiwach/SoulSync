"""
User Settings API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
import uuid

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

class UserSettings(BaseModel):
    risk_monitoring_enabled: bool = Field(default=True, description="Enable/disable risk monitoring")
    quiet_hours_enabled: bool = Field(default=False, description="Enable/disable quiet hours")
    quiet_hours_start: str = Field(default="22:00", pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$", description="Quiet hours start time (HH:MM)")
    quiet_hours_end: str = Field(default="08:00", pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$", description="Quiet hours end time (HH:MM)")

class UserSettingsResponse(BaseModel):
    risk_monitoring_enabled: bool
    quiet_hours_enabled: bool
    quiet_hours_start: str
    quiet_hours_end: str

@router.get("/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's settings"""
    try:
        user_id = current_user["user_id"]
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get settings from user metadata or use defaults
        settings_data = user.settings or {}
        
        settings = UserSettingsResponse(
            risk_monitoring_enabled=settings_data.get("risk_monitoring_enabled", True),
            quiet_hours_enabled=settings_data.get("quiet_hours_enabled", False),
            quiet_hours_start=settings_data.get("quiet_hours_start", "22:00"),
            quiet_hours_end=settings_data.get("quiet_hours_end", "08:00"),
        )
        
        logger.info("settings_retrieved", user_id=user_id, settings=settings.dict())
        return settings
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_settings_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve settings")

@router.put("/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    settings: UserSettings,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's settings"""
    try:
        user_id = current_user["user_id"]
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user settings
        user.settings = settings.dict()
        db.commit()
        
        logger.info("settings_updated", user_id=user_id, settings=settings.dict())
        
        return UserSettingsResponse(
            risk_monitoring_enabled=settings.risk_monitoring_enabled,
            quiet_hours_enabled=settings.quiet_hours_enabled,
            quiet_hours_start=settings.quiet_hours_start,
            quiet_hours_end=settings.quiet_hours_end,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_settings_failed", error=str(e))
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update settings")
