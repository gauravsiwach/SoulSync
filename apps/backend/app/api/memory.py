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
        
        # If we have fewer than 5 facts, try to get more from recent Qdrant memories
        if len(facts) < 5 and memory_count > 0:
            try:
                from app.services.embedding_service import embedding_service
                # Get recent memories
                query_embedding = embedding_service.get_embedding("important facts about me")
                memories = qdrant_service.search_memories(
                    user_id=str(user_id),
                    query_embedding=query_embedding,
                    limit=10
                )
                
                # Extract content from memories and add as facts if not already present
                for memory in memories:
                    content = memory.get('content', '') if isinstance(memory, dict) else ''
                    
                    if content and content not in facts and len(facts) < 5:
                        # Truncate long memories to fact-sized snippets
                        if len(content) > 150:
                            content = content[:147] + "..."
                        facts.append(content)
            except Exception as e:
                logger.warning("failed_to_augment_facts_from_qdrant", error=str(e))
        
        logger.info("memory_summary_retrieved", user_id=user_id, memory_count=memory_count, facts_count=len(facts))
        
        return MemorySummaryResponse(
            memory_count=memory_count,
            facts=facts[:5],  # Ensure max 5 facts
            last_updated=last_updated
        )
        
    except Exception as e:
        logger.error("memory_summary_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve memory summary")
