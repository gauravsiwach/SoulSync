"""
Risk Monitor Development API
For development/testing - triggers risk monitoring manually
"""
from fastapi import APIRouter, HTTPException
from app.tasks.risk_monitor_worker import monitor_user_risks
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

@router.post("/risk-monitor/trigger")
async def trigger_risk_monitor():
    """
    Development endpoint to trigger risk monitoring manually
    No authentication required for development
    """
    try:
        logger.info("manual_risk_monitor_trigger_started")
        
        # Trigger the risk monitoring job
        result = monitor_user_risks()
        
        logger.info("manual_risk_monitor_completed")
        
        return {
            "status": "success",
            "message": "Risk monitoring triggered successfully",
            "result": str(result),
            "timestamp": "completed"
        }
        
    except Exception as e:
        logger.error("manual_risk_monitor_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to trigger risk monitoring: {str(e)}")
