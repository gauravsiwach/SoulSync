from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from app.core.security import get_current_user
from app.core.logging import get_logger, log_api_request, log_api_response
from app.db.database import get_db
from app.models.notification import Notification
import time

logger = get_logger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    channel: str
    status: str
    created_at: str


@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notifications for current user"""
    start_time = time.time()
    log_api_request("GET", "/notifications", current_user["user_id"])
    
    try:
        notifications = db.query(Notification).filter(
            Notification.user_id == current_user["user_id"]
        ).order_by(Notification.created_at.desc()).limit(50).all()
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", "/notifications", 200, duration)
        logger.info("notifications_retrieved", user_id=current_user["user_id"], count=len(notifications))
        
        return [
            NotificationResponse(
                id=str(notification.id),
                user_id=str(notification.user_id),
                type=notification.type,
                title=notification.title,
                body=notification.body,
                channel=notification.channel,
                status=notification.status,
                created_at=notification.created_at.isoformat()
            )
            for notification in notifications
        ]
        
    except Exception as e:
        logger.error("get_notifications_error", error=str(e))
        raise Exception("Failed to retrieve notifications")


from pydantic import BaseModel
