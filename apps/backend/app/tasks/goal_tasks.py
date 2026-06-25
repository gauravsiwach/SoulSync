from celery import Celery
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.goal import Goal
from app.models.goal_checkin import GoalCheckin
from app.core.logging import get_logger

logger = get_logger(__name__)

# Create Celery instance
celery_app = Celery('soulsync', broker='redis://localhost:6380/0')

@celery_app.task
def check_stale_goals():
    """Check for goals with no check-in for > 3 days and queue nudges"""
    logger.info("check_stale_goals_started")
    
    try:
        db = next(get_db())
        
        # Get all active goals
        active_goals = db.query(Goal).filter(Goal.status == 'active').all()
        
        stale_threshold = datetime.now() - timedelta(days=3)
        stale_goals = []
        
        for goal in active_goals:
            # Get the most recent check-in for this goal
            latest_checkin = db.query(GoalCheckin).filter(
                GoalCheckin.goal_id == goal.id
            ).order_by(GoalCheckin.created_at.desc()).first()
            
            # If no check-ins or latest check-in is > 3 days old
            if not latest_checkin or latest_checkin.created_at < stale_threshold:
                stale_goals.append({
                    'goal_id': str(goal.id),
                    'user_id': str(goal.user_id),
                    'goal_title': goal.title,
                    'last_checkin': latest_checkin.created_at.isoformat() if latest_checkin else None
                })
        
        logger.info("stale_goals_found", count=len(stale_goals))
        
        # Queue nudges for stale goals
        for stale_goal in stale_goals:
            logger.info("queueing_goal_nudge", goal_id=stale_goal['goal_id'], user_id=stale_goal['user_id'])
            # TODO: Implement actual nudge notification queueing
            # This will be implemented when notifications are added in Phase 5
        
        db.close()
        logger.info("check_stale_goals_completed")
        
    except Exception as e:
        logger.error("check_stale_goals_error", error=str(e))
        if 'db' in locals():
            db.close()
