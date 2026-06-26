from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict
from app.core.security import get_current_user
from app.core.logging import get_logger, log_api_request, log_api_response
from app.db.database import get_db
from app.models.message import Message
from app.models.conversation import Conversation
import time

logger = get_logger(__name__)
router = APIRouter(prefix="/mood", tags=["mood"])


@router.get("/summary")
async def get_mood_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get mood summary for the last 7 days"""
    start_time = time.time()
    log_api_request("GET", "/mood/summary", current_user["user_id"])
    
    try:
        # Get messages from last 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        messages = db.query(Message).join(
            Conversation
        ).filter(
            Conversation.user_id == current_user["user_id"],
            Message.created_at >= seven_days_ago
        ).order_by(Message.created_at.asc()).all()
        
        # Aggregate mood tags
        mood_distribution = {}
        mood_timeline = []
        
        for message in messages:
            if message.mood_tag:
                mood_distribution[message.mood_tag] = mood_distribution.get(message.mood_tag, 0) + 1
                
                # Add to timeline (group by day)
                day_key = message.created_at.strftime("%Y-%m-%d")
                mood_timeline.append({
                    "date": day_key,
                    "mood": message.mood_tag,
                    "timestamp": message.created_at.isoformat()
                })
        
        # Calculate dominant mood
        dominant_mood = None
        if mood_distribution:
            dominant_mood = max(mood_distribution, key=mood_distribution.get)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", "/mood/summary", 200, duration)
        logger.info("mood_summary_retrieved", user_id=current_user["user_id"], message_count=len(messages))
        
        return {
            "period": "7_days",
            "message_count": len(messages),
            "mood_distribution": mood_distribution,
            "dominant_mood": dominant_mood,
            "mood_timeline": mood_timeline
        }
        
    except Exception as e:
        logger.error("mood_summary_error", error=str(e))
        raise Exception("Failed to retrieve mood summary")
