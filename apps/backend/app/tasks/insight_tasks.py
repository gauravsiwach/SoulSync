from celery import shared_task
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

from app.db.database import get_db
from app.models.user import User
from app.models.user_insight import UserInsight
from app.models.message import Message
from app.models.goal_checkin import GoalCheckin
from app.services.qdrant_service import qdrant_service
from app.services.embedding_service import embedding_service
from app.services.ai_service import AIService
from app.core.logging import get_logger

logger = get_logger(__name__)


@shared_task(name="generate_daily_insights")
def generate_daily_insights():
    """Generate daily insights for all users - runs at 8 AM user local time"""
    db: Session = next(get_db())
    
    try:
        users = db.query(User).all()
        logger.info("insight_generation_started", user_count=len(users))
        
        for user in users:
            try:
                _generate_user_insights(user.id, db)
            except Exception as e:
                logger.error("user_insight_generation_failed", user_id=str(user.id), error=str(e))
                continue
                
        logger.info("insight_generation_completed")
        
    except Exception as e:
        logger.error("insight_generation_task_failed", error=str(e))
    finally:
        db.close()


def _generate_user_insights(user_id: str, db: Session):
    """Generate insights for a single user"""
    # Fetch last 7 days of data
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Fetch Qdrant memories
    try:
        # Generate embedding for search query
        query_text = "recent activity and patterns"
        query_embedding = embedding_service.get_embedding(query_text)
        memories = qdrant_service.search_memories(
            user_id=str(user_id),
            query_embedding=query_embedding,
            limit=10
        )
    except Exception as e:
        logger.error("qdrant_search_failed", user_id=user_id, error=str(e))
        memories = []
    
    # Fetch recent messages for mood analysis
    from app.models.conversation import Conversation
    messages = db.query(Message).join(
        Conversation, Message.conversation_id == Conversation.id
    ).filter(
        Conversation.user_id == user_id,
        Message.created_at >= seven_days_ago
    ).order_by(Message.created_at.desc()).limit(50).all()
    
    # Fetch recent check-ins
    from app.models.goal import Goal
    checkins = db.query(GoalCheckin).join(
        Goal, GoalCheckin.goal_id == Goal.id
    ).filter(
        Goal.user_id == user_id,
        GoalCheckin.created_at >= seven_days_ago
    ).order_by(GoalCheckin.created_at.desc()).all()
    
    # Prepare context for LLM
    context = {
        "memories": [m.get('payload', {}) if isinstance(m, dict) else m.payload for m in memories] if memories else [],
        "message_count": len(messages),
        "checkin_count": len(checkins),
        "recent_checkins": [
            {"score": c.progress_score, "note": c.note, "date": c.created_at.isoformat()}
            for c in checkins[:5]
        ]
    }
    
    # Generate insights using AI
    try:
        ai_service = AIService()
        insights = ai_service.generate_insights(context)
        
        # Archive old insights (keep max 5 active)
        active_insights = db.query(UserInsight).filter(
            UserInsight.user_id == user_id,
            UserInsight.surfaced == False
        ).all()
        
        if len(active_insights) >= 5:
            # Mark oldest as surfaced (archive)
            insights_to_archive = sorted(active_insights, key=lambda x: x.created_at)[:len(active_insights) - 4]
            for insight in insights_to_archive:
                insight.surfaced = True
            db.commit()
        
        # Store new insights
        for insight_data in insights:
            insight = UserInsight(
                user_id=user_id,
                category=insight_data.get("category", "general"),
                content=insight_data.get("content"),
                confidence=insight_data.get("confidence", 0.8),
                surfaced=False
            )
            db.add(insight)
        
        db.commit()
        logger.info("user_insights_generated", user_id=user_id, count=len(insights))
        
    except Exception as e:
        logger.error("llm_insight_generation_failed", user_id=user_id, error=str(e))
        db.rollback()
