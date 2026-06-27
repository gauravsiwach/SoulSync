from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class TrustCircleMember(Base):
    __tablename__ = "trust_circle_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    alert_level = Column(String, nullable=False, server_default='concern')  # 'concern' | 'urgent' | 'emergency'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
