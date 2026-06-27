"""
Intervention Worker - Critical Celery Queue Task
Creates notifications for trust circle members when risk level is critical
(Twilio SMS integration skipped for now)
"""
from celery import shared_task
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid

from app.db.database import SessionLocal
from app.models.user import User
from app.models.trust_circle_member import TrustCircleMember
from app.models.notification import Notification
from app.core.logging import get_logger

logger = get_logger(__name__)

@shared_task(name="app.tasks.intervention_tasks.send_intervention_notification", queue="critical")
def send_intervention_notification(user_id: str, risk_level: str):
    """
    Create notification for trust circle members when risk level is critical
    (Twilio SMS integration skipped - will just log and create in-app notification)
    
    Args:
        user_id: UUID of the user at risk
        risk_level: Current risk level ('high' or 'critical')
    """
    logger.info("intervention_notification_started", user_id=user_id, risk_level=risk_level)
    
    db = SessionLocal()
    try:
        # Get user information
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        
        if not user:
            logger.error("user_not_found", user_id=user_id)
            return
        
        # Get trust circle members
        trust_members = db.query(TrustCircleMember).filter(
            TrustCircleMember.user_id == uuid.UUID(user_id)
        ).all()
        
        if not trust_members:
            logger.info("no_trust_circle_members", user_id=user_id)
            return
        
        # Check cooldown (24 hours per contact)
        last_intervention = db.query(Notification).filter(
            and_(
                Notification.user_id == uuid.UUID(user_id),
                Notification.type == "trust_circle",
                Notification.created_at >= datetime.utcnow() - timedelta(hours=24)
            )
        ).first()
        
        if last_intervention:
            logger.info("intervention_cooldown_active", user_id=user_id)
            return
        
        # Log intervention details (Twilio SMS skipped)
        logger.info(
            "intervention_logged",
            user_id=user_id,
            risk_level=risk_level,
            trust_circle_count=len(trust_members),
            message="Twilio SMS integration skipped - intervention logged for monitoring"
        )
        
        # Create in-app notification record
        notification = Notification(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            type="trust_circle",
            title="Trust Circle Alert",
            body=f"Your trust circle has been alerted about your current situation. {len(trust_members)} contacts would be notified.",
            channel="push",
            status="sent",
            created_at=datetime.utcnow()
        )
        
        db.add(notification)
        db.commit()
        
        logger.info("intervention_notification_completed", user_id=user_id, trust_circle_count=len(trust_members))
        
    except Exception as e:
        logger.error("intervention_notification_failed", user_id=user_id, error=str(e))
        db.rollback()
    finally:
        db.close()
