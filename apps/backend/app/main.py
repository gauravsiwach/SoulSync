from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.auth import router as auth_router
from app.api.profile import router as profile_router
from app.api.conversations import router as conversations_router
from app.api.websocket import router as websocket_router
from app.api.memory import router as memory_router
from app.api.goals import router as goals_router
from app.api.checkins import router as checkins_router
from app.api.mood import router as mood_router
from app.api.insights import router as insights_router
from app.api.notifications import router as notifications_router
from app.api.trust_circle import router as trust_circle_router
from app.api.risk_scores import router as risk_scores_router
from app.api.settings import router as settings_router
from app.api.risk_monitor import router as risk_monitor_router
from app.core.logging import configure_logging, get_logger
from app.core.config import get_settings
from app.db.database import Base, engine
from app.models import *  # Import all models to register them with SQLAlchemy

# Configure logging
settings = get_settings()
configure_logging(settings.DEBUG and "DEBUG" or "INFO")

# Get logger
logger = get_logger(__name__)

app = FastAPI(title="SoulSync Backend")

@app.on_event("startup")
async def startup_event():
    """Initialize database and Qdrant on startup"""
    try:
        logger.info("database_initialization_started")
        
        # Create all tables if they don't exist
        Base.metadata.create_all(bind=engine)
        logger.info("database_tables_created", tables=list(Base.metadata.tables.keys()))
        
        # Migration: Add Phase 5 columns to users table
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            
            # Add Phase 5 columns if they don't exist
            if 'fcm_token' not in columns:
                logger.info("migration_adding_fcm_token_column")
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE users ADD COLUMN fcm_token TEXT'))
                    conn.commit()
                logger.info("migration_fcm_token_column_added")
            
            if 'preferred_checkin_time' not in columns:
                logger.info("migration_adding_preferred_checkin_time_column")
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE users ADD COLUMN preferred_checkin_time TIME'))
                    conn.commit()
                logger.info("migration_preferred_checkin_time_column_added")
            
            # Add Phase 6 columns if they don't exist
            if 'settings' not in columns:
                logger.info("migration_adding_settings_column")
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE users ADD COLUMN settings JSON'))
                    conn.commit()
                logger.info("migration_settings_column_added")
                
            logger.info("migration_phase6_columns_completed")
        except Exception as migration_error:
            logger.error("migration_failed", error=str(migration_error))
            
    except Exception as e:
        logger.error("database_initialization_failed", error=str(e))
        raise
    
    # Initialize Qdrant collection for Phase 3
    try:
        from app.services.qdrant_service import qdrant_service
        logger.info("qdrant_initialization_started")
        qdrant_service.initialize_collection()
        logger.info("qdrant_initialization_completed")
    except Exception as e:
        logger.error("qdrant_initialization_failed", error=str(e))
        # Don't raise - allow app to start even if Qdrant fails

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8082", "http://127.0.0.1:8082"],  # Mobile app URL
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(chat_router)
app.include_router(conversations_router, prefix="/api", tags=["conversations"])
app.include_router(websocket_router, tags=["websocket"])
app.include_router(memory_router, prefix="/api", tags=["memory"])
app.include_router(goals_router, prefix="/api", tags=["goals"])
app.include_router(checkins_router, prefix="/api", tags=["checkins"])
app.include_router(mood_router, prefix="/api", tags=["mood"])
app.include_router(insights_router, prefix="/api", tags=["insights"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(trust_circle_router, prefix="/api", tags=["trust-circle"])
app.include_router(risk_scores_router, prefix="/api", tags=["risk-scores"])
app.include_router(settings_router, prefix="/api", tags=["settings"])
app.include_router(risk_monitor_router, prefix="/api", tags=["risk-monitor"])


@app.get("/health")
async def health():
    logger.info("health_check_called")
    return {"status": "ok"}


@app.get("/health/detailed")
async def health_detailed():
    logger.info("detailed_health_check_called")
    # Detailed checks can be implemented later (Postgres/Redis/Qdrant)
    return {
        "status": "ok",
        "services": {"postgres": "unknown", "redis": "unknown", "qdrant": "unknown"},
    }
