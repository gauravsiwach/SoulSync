"""
Memory API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.security import get_current_user
from app.db.database import get_db
from app.services.qdrant_service import qdrant_service
from app.models.user_profile import UserProfile
from app.core.logging import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)
router = APIRouter()

class MemorySummaryResponse(BaseModel):
    memory_count: int
    facts: list
    last_updated: int | None

@router.get("/memory/summary")
async def get_memory_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get memory summary for the current user"""
    try:
        user_id = current_user["user_id"]
        
        # Get memory count from Qdrant
        memory_count = qdrant_service.get_user_memory_count(user_id)
        
        # Get facts from user profile
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        facts = []
        last_updated = None
        
        if profile and profile.ai_profile:
            facts = profile.ai_profile.get("facts", [])
            last_updated = profile.ai_profile.get("last_updated")
        
        logger.info("memory_summary_retrieved", user_id=user_id, memory_count=memory_count, facts_count=len(facts))
        
        return MemorySummaryResponse(
            memory_count=memory_count,
            facts=facts,
            last_updated=last_updated
        )
        
    except Exception as e:
        logger.error("memory_summary_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve memory summary")
