"""
Risk Monitor Worker - Celery Beat Task
Runs every 4 hours to compute risk scores and trigger interventions
"""
from celery import shared_task
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid

from app.db.database import SessionLocal
from app.models.user import User
from app.models.risk_score import RiskScore
from app.tasks.risk_monitoring_tasks import compute_risk_scores, should_trigger_intervention
from app.core.logging import get_logger

logger = get_logger(__name__)

@shared_task(name="app.tasks.risk_monitor_worker.monitor_user_risks")
def monitor_user_risks():
    """
    Celery beat task that runs every 4 hours to:
    1. Compute risk scores for all users with risk monitoring enabled
    2. Store scores in database
    3. Trigger intervention if threshold exceeded
    """
    logger.info("risk_monitor_worker_started")
    
    db = SessionLocal()
    try:
        # Get all users
        users = db.query(User).all()
        
        for user in users:
            try:
                # Compute risk scores
                scores = compute_risk_scores(user.id, db)
                
                # Store risk score
                risk_score = RiskScore(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    isolation_score=scores["isolation_score"],
                    burnout_score=scores["burnout_score"],
                    distress_score=scores["distress_score"],
                    crisis_probability=scores["crisis_probability"],
                    overall_level=scores["overall_level"],
                    scored_at=datetime.utcnow()
                )
                
                db.add(risk_score)
                db.commit()
                
                # Check if intervention should be triggered
                if should_trigger_intervention(user.id, scores["overall_level"], db):
                    logger.info(
                        "intervention_triggered",
                        user_id=str(user.id),
                        overall_level=scores["overall_level"]
                    )
                    # Queue intervention task
                    from app.tasks.intervention_tasks import send_intervention_notification
                    send_intervention_notification.delay(str(user.id), scores["overall_level"])
                
            except Exception as e:
                logger.error("risk_monitor_user_failed", user_id=str(user.id), error=str(e))
                db.rollback()
                continue
        
        logger.info("risk_monitor_worker_completed", user_count=len(users))
        
    except Exception as e:
        logger.error("risk_monitor_worker_failed", error=str(e))
    finally:
        db.close()
