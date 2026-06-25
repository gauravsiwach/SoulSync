from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from app.core.security import get_current_user
from app.core.logging import get_logger, log_api_request, log_api_response
from app.db.database import get_db
from app.models.user import User
from app.models.goal import Goal
import time

logger = get_logger(__name__)
router = APIRouter(prefix="/goals", tags=["goals"])

# Pydantic models
class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[date] = None

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[date] = None
    status: Optional[str] = None  # 'active' | 'completed' | 'abandoned'
    milestones: Optional[list] = None

class GoalResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str]
    category: Optional[str]
    target_date: Optional[str]
    status: str
    milestones: list
    created_at: str
    updated_at: str

@router.post("", response_model=GoalResponse)
async def create_goal(
    goal_data: GoalCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new goal"""
    start_time = time.time()
    log_api_request("POST", "/goals", current_user["user_id"])
    
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        goal = Goal(
            user_id=user.id,
            title=goal_data.title,
            description=goal_data.description,
            category=goal_data.category,
            target_date=goal_data.target_date,
            status="active",
            milestones=[]
        )
        
        db.add(goal)
        db.commit()
        db.refresh(goal)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("POST", "/goals", 201, duration)
        logger.info("goal_created", user_id=user.id, goal_id=str(goal.id))
        
        return GoalResponse(
            id=str(goal.id),
            user_id=str(goal.user_id),
            title=goal.title,
            description=goal.description,
            category=goal.category,
            target_date=goal.target_date.isoformat() if goal.target_date else None,
            status=goal.status,
            milestones=goal.milestones or [],
            created_at=goal.created_at.isoformat(),
            updated_at=goal.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_goal_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create goal")

@router.get("", response_model=list[GoalResponse])
async def list_goals(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all goals for current user"""
    start_time = time.time()
    log_api_request("GET", "/goals", current_user["user_id"])
    
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        goals = db.query(Goal).filter(Goal.user_id == user.id).all()
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", "/goals", 200, duration)
        logger.info("goals_listed", user_id=user.id, count=len(goals))
        
        return [
            GoalResponse(
                id=str(goal.id),
                user_id=str(goal.user_id),
                title=goal.title,
                description=goal.description,
                category=goal.category,
                target_date=goal.target_date.isoformat() if goal.target_date else None,
                status=goal.status,
                milestones=goal.milestones or [],
                created_at=goal.created_at.isoformat(),
                updated_at=goal.updated_at.isoformat()
            )
            for goal in goals
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_goals_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list goals")

@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific goal"""
    start_time = time.time()
    log_api_request("GET", f"/goals/{goal_id}", current_user["user_id"])
    
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        goal = db.query(Goal).filter(
            Goal.id == goal_id,
            Goal.user_id == user.id
        ).first()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", f"/goals/{goal_id}", 200, duration)
        logger.info("goal_retrieved", user_id=user.id, goal_id=str(goal.id))
        
        return GoalResponse(
            id=str(goal.id),
            user_id=str(goal.user_id),
            title=goal.title,
            description=goal.description,
            category=goal.category,
            target_date=goal.target_date.isoformat() if goal.target_date else None,
            status=goal.status,
            milestones=goal.milestones or [],
            created_at=goal.created_at.isoformat(),
            updated_at=goal.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_goal_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve goal")

@router.patch("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: str,
    goal_update: GoalUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a goal"""
    start_time = time.time()
    log_api_request("PATCH", f"/goals/{goal_id}", current_user["user_id"])
    
    try:
        user = db.query(User).filter(User.id == current_user["user_id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        goal = db.query(Goal).filter(
            Goal.id == goal_id,
            Goal.user_id == user.id
        ).first()
        
        if not goal:
            raise HTTPException(status_code=404, detail="Goal not found")
        
        if goal_update.title is not None:
            goal.title = goal_update.title
        if goal_update.description is not None:
            goal.description = goal_update.description
        if goal_update.category is not None:
            goal.category = goal_update.category
        if goal_update.target_date is not None:
            goal.target_date = goal_update.target_date
        if goal_update.status is not None:
            goal.status = goal_update.status
        if goal_update.milestones is not None:
            goal.milestones = goal_update.milestones
        
        db.commit()
        db.refresh(goal)
        
        duration = (time.time() - start_time) * 1000
        log_api_response("PATCH", f"/goals/{goal_id}", 200, duration)
        logger.info("goal_updated", user_id=user.id, goal_id=str(goal.id))
        
        return GoalResponse(
            id=str(goal.id),
            user_id=str(goal.user_id),
            title=goal.title,
            description=goal.description,
            category=goal.category,
            target_date=goal.target_date.isoformat() if goal.target_date else None,
            status=goal.status,
            milestones=goal.milestones or [],
            created_at=goal.created_at.isoformat(),
            updated_at=goal.updated_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_goal_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update goal")
