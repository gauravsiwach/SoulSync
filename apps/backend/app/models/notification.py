from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    type = Column(String, nullable=False)  # 'check_in', 'goal_nudge', 'trust_circle', etc.
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    channel = Column(String, nullable=False)  # 'push' | 'sms' | 'email'
    status = Column(String, nullable=False)  # 'sent' | 'delivered' | 'failed'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
