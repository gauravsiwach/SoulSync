from sqlalchemy import Column, String, DateTime, Boolean, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String, nullable=True)
    age_range = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    location = Column(String, nullable=True)
    relationship_status = Column(String, nullable=True)
    interests = Column(ARRAY(String), nullable=True)
    ai_profile = Column(JSONB, default={})
    risk_monitoring_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
