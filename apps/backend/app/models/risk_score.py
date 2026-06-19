from sqlalchemy import Column, String, DateTime, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class RiskScore(Base):
    __tablename__ = "risk_scores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    isolation_score = Column(Integer, nullable=False)  # 0-100
    burnout_score = Column(Integer, nullable=False)  # 0-100
    distress_score = Column(Integer, nullable=False)  # 0-100
    crisis_probability = Column(Float, nullable=False)  # 0-1.0
    overall_level = Column(String, nullable=False)  # 'low' | 'medium' | 'high' | 'critical'
    scored_at = Column(DateTime(timezone=True), server_default=func.now())
