"""
Trust Circle API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
import uuid

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.trust_circle_member import TrustCircleMember
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

class TrustCircleMemberCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    alert_level: str = Field(default="concern", pattern="^(concern|urgent|emergency)$")

class TrustCircleMemberResponse(BaseModel):
    id: UUID
    name: str
    phone: str
    email: Optional[str]
    alert_level: str
    created_at: str

@router.get("/trust-circle", response_model=List[TrustCircleMemberResponse])
async def get_trust_circle(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all trust circle members for the current user"""
    try:
        user_id = current_user["user_id"]
        
        members = db.query(TrustCircleMember).filter(
            TrustCircleMember.user_id == user_id
        ).order_by(TrustCircleMember.created_at.desc()).all()
        
        logger.info("trust_circle_retrieved", user_id=user_id, count=len(members))
        
        return [
            {
                "id": member.id,
                "name": member.name,
                "phone": member.phone,
                "email": member.email,
                "alert_level": member.alert_level,
                "created_at": member.created_at.isoformat()
            }
            for member in members
        ]
    except Exception as e:
        logger.error("trust_circle_retrieval_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve trust circle members")

@router.post("/trust-circle", response_model=TrustCircleMemberResponse)
async def create_trust_circle_member(
    member_data: TrustCircleMemberCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new trust circle member"""
    try:
        user_id = current_user["user_id"]
        
        # Create new member
        new_member = TrustCircleMember(
            id=uuid.uuid4(),
            user_id=user_id,
            name=member_data.name,
            phone=member_data.phone,
            email=member_data.email,
            alert_level=member_data.alert_level
        )
        
        db.add(new_member)
        db.commit()
        db.refresh(new_member)
        
        logger.info("trust_circle_member_created", user_id=user_id, member_id=str(new_member.id))
        
        return {
            "id": new_member.id,
            "name": new_member.name,
            "phone": new_member.phone,
            "email": new_member.email,
            "alert_level": new_member.alert_level,
            "created_at": new_member.created_at.isoformat()
        }
    except Exception as e:
        logger.error("trust_circle_member_creation_failed", error=str(e))
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create trust circle member")

@router.delete("/trust-circle/{member_id}")
async def delete_trust_circle_member(
    member_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a trust circle member"""
    try:
        user_id = current_user["user_id"]
        
        # Find member and verify ownership
        member = db.query(TrustCircleMember).filter(
            TrustCircleMember.id == member_id,
            TrustCircleMember.user_id == user_id
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="Trust circle member not found")
        
        db.delete(member)
        db.commit()
        
        logger.info("trust_circle_member_deleted", user_id=user_id, member_id=str(member_id))
        
        return {"message": "Trust circle member deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("trust_circle_member_deletion_failed", error=str(e))
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete trust circle member")
