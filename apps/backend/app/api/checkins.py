from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.core.security import get_current_user
from app.core.logging import get_logger, log_api_request, log_api_response
from app.db.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.models.goal_checkin import GoalCheckin
import time

logger = get_logger(__name__)
router = APIRouter(prefix="/checkins", tags=["checkins"])

# Pydantic models
class CheckinCreate(BaseModel):
    progress_score: int  # 1-5
    note: Optional[str] = None
    source: Optional[str] = "user"  # 'user' | 'ai_inferred'

class CheckinResponse(BaseModel):
    id: str
    goal_id: str
    progress_score: int
    note: Optional[str]
    source: str
    created_at: str

@router.post("/goals/{goal_id}", response_model=CheckinResponse)
async def create_checkin(
    goal_id: str,
    checkin_data: CheckinCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new check-in for a goal"""
    start_time = time.time()
    log_api_request("POST", f"/checkins/goals/{goal_id}", current_user["user_id"])
    
    try:
        # Validate progress score
        if checkin_data.progress_score < 1 or checkin_data.progress_score > 5:
            raise HTTPException(status_code=400, detail="Progress score must be between 1 and 5")
        
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify goal exists and belongs to user
        goal = db.query(Goal).filter(
            Goal.id == goal_id,
            Goal.user_id == user.id
        ).first()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        checkin = GoalCheckin(
            goal_id=goal.id,
            progress_score=checkin_data.progress_score,
            note=checkin_data.note,
            source=checkin_data.source
        )
        
        db.add(checkin)
        db.commit()
        db.refresh(checkin)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("POST", f"/checkins/goals/{goal_id}", 201, duration)
        logger.info("checkin_created", user_id=user.id, goal_id=str(goal.id), checkin_id=str(checkin.id))
        
        return CheckinResponse(
            id=str(checkin.id),
            goal_id=str(checkin.goal_id),
            progress_score=checkin.progress_score,
            note=checkin.note,
            source=checkin.source,
            created_at=checkin.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_checkin_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create check-in")

@router.get("/goals/{goal_id}", response_model=list[CheckinResponse])
async def list_checkins(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all check-ins for a goal"""
    start_time = time.time()
    log_api_request("GET", f"/checkins/goals/{goal_id}", current_user["user_id"])
    
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify goal exists and belongs to user
        goal = db.query(Goal).filter(
            Goal.id == goal_id,
            Goal.user_id == user.id
        ).first()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        checkins = db.query(GoalCheckin).filter(GoalCheckin.goal_id == goal.id).order_by(GoalCheckin.created_at.desc()).all()
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", f"/checkins/goals/{goal_id}", 200, duration)
        logger.info("checkins_listed", user_id=user.id, goal_id=str(goal.id), count=len(checkins))
        
        return [
            CheckinResponse(
                id=str(checkin.id),
                goal_id=str(checkin.goal_id),
                progress_score=checkin.progress_score,
                note=checkin.note,
                source=checkin.source,
                created_at=checkin.created_at.isoformat()
            )
            for checkin in checkins
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_checkins_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list check-ins")
