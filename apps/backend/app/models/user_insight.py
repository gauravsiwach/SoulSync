from sqlalchemy import Column, String, DateTime, Text, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class UserInsight(Base):
    __tablename__ = "user_insights"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    category = Column(String, nullable=False)  # 'mood_trend', 'goal_drift', 'positive_pattern', etc.
    content = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    surfaced = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
