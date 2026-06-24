from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.auth import router as auth_router
from app.api.profile import router as profile_router
from app.api.conversations import router as conversations_router
from app.api.websocket import router as websocket_router
from app.api.memory import router as memory_router
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
        
        # Migration: Recreate users table for Phase 1 schema
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            
            # Check if users table has the correct Phase 1 schema
            # Phase 1 uses: display_name (not name, not is_active, not fcm_token)
            has_old_schema = ('name' in columns or 'is_active' in columns or 
                            'fcm_token' in columns or 'display_name' not in columns)
            
            if has_old_schema:
                logger.info("migration_recreating_users_table_for_phase1")
                with engine.connect() as conn:
                    # Drop and recreate users table with Phase 1 schema
                    conn.execute(text('DROP TABLE IF EXISTS users CASCADE'))
                    conn.commit()
                logger.info("migration_users_table_dropped")
                
                # Recreate with Phase 1 schema
                Base.metadata.create_all(bind=engine)
                logger.info("migration_users_table_recreated_phase1")
            else:
                logger.info("migration_users_table_schema_correct_phase1")
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(chat_router)
app.include_router(conversations_router, prefix="/api", tags=["conversations"])
app.include_router(websocket_router, tags=["websocket"])
app.include_router(memory_router, prefix="/api", tags=["memory"])


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
