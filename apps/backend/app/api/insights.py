from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from app.core.security import get_current_user
from app.core.logging import get_logger, log_api_request, log_api_response
from app.db.database import get_db
from app.models.user_insight import UserInsight
from app.tasks.insight_tasks import generate_daily_insights
import time

logger = get_logger(__name__)
router = APIRouter(prefix="/insights", tags=["insights"])


class InsightSurfaceUpdate(BaseModel):
    surfaced: bool


class InsightResponse(BaseModel):
    id: str
    user_id: str
    category: str
    content: str
    confidence: float
    surfaced: bool
    created_at: str


@router.get("/latest", response_model=List[InsightResponse])
async def get_latest_insights(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get latest unsurfaced insights for current user"""
    start_time = time.time()
    log_api_request("GET", "/insights/latest", current_user["user_id"])
    
    try:
        insights = db.query(UserInsight).filter(
            UserInsight.user_id == current_user["user_id"],
            UserInsight.surfaced == False
        ).order_by(UserInsight.created_at.desc()).limit(5).all()
        
        duration = (time.time() - start_time) * 1000
        log_api_response("GET", "/insights/latest", 200, duration)
        logger.info("latest_insights_retrieved", user_id=current_user["user_id"], count=len(insights))
        
        return [
            InsightResponse(
                id=str(insight.id),
                user_id=str(insight.user_id),
                category=insight.category,
                content=insight.content,
                confidence=insight.confidence,
                surfaced=insight.surfaced,
                created_at=insight.created_at.isoformat()
            )
            for insight in insights
        ]
        
    except Exception as e:
        logger.error("get_latest_insights_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve insights")


@router.patch("/{insight_id}/surface")
async def mark_insight_surfaced(
    insight_id: str,
    update: InsightSurfaceUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark an insight as surfaced/dismissed"""
    start_time = time.time()
    log_api_request("PATCH", f"/insights/{insight_id}/surface", current_user["user_id"])
    
    try:
        insight = db.query(UserInsight).filter(
            UserInsight.id == insight_id,
            UserInsight.user_id == current_user["user_id"]
        ).first()
        
        if not insight:
            raise HTTPException(status_code=404, detail="Insight not found")

        insight.surfaced = update.surfaced
        db.commit()
        
        duration = (time.time() - start_time) * 1000
        log_api_response("PATCH", f"/insights/{insight_id}/surface", 200, duration)
        logger.info("insight_surfaced", insight_id=insight_id, surfaced=update.surfaced)
        
        return {"status": "success", "surfaced": insight.surfaced}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("mark_insight_surfaced_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update insight")


@router.post("/generate")
async def trigger_insight_generation():
    """Manually trigger insight generation for testing (synchronous, no Celery)"""
    start_time = time.time()
    log_api_request("POST", "/insights/generate", "anonymous")
    
    try:
        # Call the function directly (synchronous) for testing
        result = generate_daily_insights()
        
        duration = (time.time() - start_time) * 1000
        log_api_response("POST", "/insights/generate", 200, duration)
        logger.info("insight_generation_completed", duration=duration)
        
        return {"status": "success", "message": "Insight generation completed"}
    except Exception as e:
        logger.error("insight_generation_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to generate insights: {str(e)}")
