"""
Risk Score API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.risk_score import RiskScore
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

class RiskScoreResponse(BaseModel):
    id: UUID
    user_id: UUID
    isolation_score: Optional[int]
    burnout_score: Optional[int]
    distress_score: Optional[int]
    crisis_probability: Optional[float]
    overall_level: Optional[str]
    scored_at: str

@router.get("/risk-scores/latest")
async def get_latest_risk_score(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest risk score for the current user"""
    try:
        user_id = current_user["user_id"]
        
        # Get the most recent risk score
        risk_score = db.query(RiskScore).filter(
            RiskScore.user_id == user_id
        ).order_by(desc(RiskScore.scored_at)).first()
        
        if not risk_score:
            logger.info("no_risk_score_found", user_id=user_id)
            raise HTTPException(status_code=404, detail="No risk score found")
        
        logger.info("risk_score_retrieved", user_id=user_id, overall_level=risk_score.overall_level)
        
        return {
            "id": risk_score.id,
            "user_id": risk_score.user_id,
            "isolation_score": risk_score.isolation_score,
            "burnout_score": risk_score.burnout_score,
            "distress_score": risk_score.distress_score,
            "crisis_probability": risk_score.crisis_probability,
            "overall_level": risk_score.overall_level,
            "scored_at": risk_score.scored_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("risk_score_retrieval_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve risk score")
