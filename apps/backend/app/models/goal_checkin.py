from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class GoalCheckin(Base):
    __tablename__ = "goal_checkins"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True)
    progress_score = Column(Integer, nullable=False)  # 1-5
    note = Column(Text, nullable=True)
    source = Column(String, default='user')  # 'user' | 'ai_inferred'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
