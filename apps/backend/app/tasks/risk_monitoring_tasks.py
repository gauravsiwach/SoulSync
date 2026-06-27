"""
Risk Monitoring Celery Tasks for Phase 6
"""
from celery import Celery
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Dict, List
import uuid

from app.db.database import get_db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.risk_score import RiskScore
from app.models.trust_circle_member import TrustCircleMember
from app.services.qdrant_service import qdrant_service
from app.services.embedding_service import embedding_service
from app.core.logging import get_logger

logger = get_logger(__name__)

# Crisis keyword list (conservative approach)
CRISIS_KEYWORDS = [
    # Direct expressions
    "suicide", "kill myself", "end my life", "want to die", "don't want to live",
    "hurt myself", "self harm", "cutting", "overdose",
    # Indirect expressions
    "no point in living", "better off dead", "wish I was dead",
    "can't go on", "end it all", "no reason to be here",
    "everyone would be better off without me", "burden to everyone",
    "don't want to be here anymore", "ready to give up",
    # Extreme hopelessness
    "completely hopeless", "no hope left", "nothing matters anymore",
    # Safety planning indicators
    "have a plan", "ready to do it", "going to do it"
]

def compute_risk_scores(user_id: uuid.UUID, db: Session) -> Dict[str, any]:
    """
    Compute risk scores based on user's recent activity and messages
    Returns: isolation_score, burnout_score, distress_score, crisis_probability, overall_level
    """
    try:
        # Get last 7 days of messages
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        logger.info("risk_calculation_started", user_id=str(user_id), timeframe="7_days", since_date=seven_days_ago.isoformat())
        
        messages = db.query(Message).join(Conversation).filter(
            and_(
                Conversation.user_id == user_id,
                Message.created_at >= seven_days_ago
            )
        ).all()
        
        logger.info("messages_retrieved", user_id=str(user_id), message_count=len(messages))
        
        # Log message details for debugging
        for i, msg in enumerate(messages[:5]):  # Log first 5 messages
            logger.info("message_sample", user_id=str(user_id), index=i, role=msg.role, mood_tag=msg.mood_tag, content_length=len(msg.content), created_at=msg.created_at.isoformat())
        
        # Get user profile to check if monitoring is enabled
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()
        
        if not profile or not profile.risk_monitoring_enabled:
            return {
                "isolation_score": 0,
                "burnout_score": 0,
                "distress_score": 0,
                "crisis_probability": 0.0,
                "overall_level": "low"
            }
        
        # Initialize scores
        isolation_score = 0
        burnout_score = 0
        distress_score = 0
        
        logger.info("score_calculation_started", user_id=str(user_id))
        
        # Count messages per day
        messages_by_day = {}
        for msg in messages:
            day = msg.created_at.date()
            messages_by_day[day] = messages_by_day.get(day, 0) + 1
        
        logger.info("messages_by_day_analyzed", user_id=str(user_id), days_with_messages=len(messages_by_day), messages_by_day=str(messages_by_day))
        
        # Isolation Score: Low engagement (< 1 chat/day for 5+ days)
        days_with_messages = len(messages_by_day)
        if days_with_messages < 5 and len(messages) > 0:
            isolation_score = min(100, (5 - days_with_messages) * 20)
        
        logger.info("isolation_score_calculated", user_id=str(user_id), days_with_messages=days_with_messages, isolation_score=isolation_score)
        
        # Burnout Score: Stress keywords + negative mood trend
        stress_keywords = ["stress", "overwhelmed", "exhausted", "burned out", "tired", "drained", "pressure"]
        stress_count = 0
        negative_mood_days = 0
        
        for msg in messages:
            content_lower = msg.content.lower()
            # Check for stress keywords
            if any(keyword in content_lower for keyword in stress_keywords):
                stress_count += 1
            # Check for negative mood tags
            if msg.mood_tag and msg.mood_tag in ["sad", "anxious", "angry", "frustrated"]:
                negative_mood_days += 1
        
        logger.info("stress_analysis_completed", user_id=str(user_id), stress_count=stress_count, negative_mood_days=negative_mood_days)
        
        if stress_count > 0:
            burnout_score = min(100, stress_count * 15)
        if negative_mood_days >= 3:
            burnout_score = min(100, burnout_score + negative_mood_days * 10)
        
        logger.info("burnout_score_calculated", user_id=str(user_id), burnout_score=burnout_score)
        
        # Distress Score: Negative mood > 70% of last 20 messages
        recent_messages = messages[-20:] if len(messages) >= 20 else messages
        if len(recent_messages) > 0:
            negative_count = sum(
                1 for msg in recent_messages
                if msg.mood_tag and msg.mood_tag in ["sad", "anxious", "angry", "frustrated", "hopeless"]
            )
            negative_ratio = negative_count / len(recent_messages)
            logger.info("distress_analysis", user_id=str(user_id), recent_messages_count=len(recent_messages), negative_count=negative_count, negative_ratio=round(negative_ratio, 2))
            if negative_ratio > 0.7:
                distress_score = min(100, int(negative_ratio * 100))
        
        logger.info("distress_score_calculated", user_id=str(user_id), distress_score=distress_score)
        
        # Crisis Probability: Based on combination of scores
        total_score = isolation_score + burnout_score + distress_score
        crisis_probability = min(1.0, total_score / 300)
        
        logger.info("crisis_probability_calculated", user_id=str(user_id), total_score=total_score, crisis_probability=round(crisis_probability, 3))
        
        # Determine overall level
        if crisis_probability >= 0.8:
            overall_level = "critical"
        elif crisis_probability >= 0.6:
            overall_level = "high"
        elif crisis_probability >= 0.4:
            overall_level = "medium"
        else:
            overall_level = "low"
        
        logger.info("overall_level_determined", user_id=str(user_id), crisis_probability=round(crisis_probability, 3), overall_level=overall_level)
        
        logger.info(
            "risk_scores_computed",
            user_id=str(user_id),
            isolation_score=isolation_score,
            burnout_score=burnout_score,
            distress_score=distress_score,
            crisis_probability=crisis_probability,
            overall_level=overall_level
        )
        
        return {
            "isolation_score": isolation_score,
            "burnout_score": burnout_score,
            "distress_score": distress_score,
            "crisis_probability": crisis_probability,
            "overall_level": overall_level
        }
        
    except Exception as e:
        logger.error("risk_score_computation_failed", user_id=str(user_id), error=str(e))
        # Return default low scores on error
        return {
            "isolation_score": 0,
            "burnout_score": 0,
            "distress_score": 0,
            "crisis_probability": 0.0,
            "overall_level": "low"
        }

def check_crisis_keywords(message_content: str) -> bool:
    """
    Check if message contains crisis keywords
    Returns True if crisis detected
    """
    content_lower = message_content.lower()
    logger.info("crisis_keyword_check_started", content_length=len(message_content), content_preview=message_content[:100])
    
    for keyword in CRISIS_KEYWORDS:
        if keyword in content_lower:
            logger.warning("crisis_keyword_detected", keyword=keyword, message_content=message_content[:200])
            return True
    
    logger.info("crisis_keyword_check_completed", no_crisis_found=True)
    return False

def should_trigger_intervention(user_id: uuid.UUID, current_level: str, db: Session) -> bool:
    """
    Determine if intervention should be triggered based on:
    - Current risk level (high or critical)
    - Cooldown period (24 hours per contact)
    """
    if current_level not in ["high", "critical"]:
        return False
    
    # Check if there are trust circle members
    trust_members = db.query(TrustCircleMember).filter(
        TrustCircleMember.user_id == user_id
    ).all()
    
    if not trust_members:
        logger.info("no_trust_circle_members", user_id=str(user_id))
        return False
    
    # Check cooldown for each member (using Redis would be better, but for now use database)
    # For MVP, we'll use a simple check - if last intervention was less than 24 hours ago
    from app.models.notification import Notification
    
    last_intervention = db.query(Notification).filter(
        and_(
            Notification.user_id == user_id,
            Notification.type == "trust_circle",
            Notification.created_at >= datetime.utcnow() - timedelta(hours=24)
        )
    ).first()
    
    if last_intervention:
        logger.info("intervention_cooldown_active", user_id=str(user_id))
        return False
    
    return True
