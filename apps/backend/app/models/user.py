from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    provider = Column(String, nullable=False)  # 'google' | 'apple'
    provider_id = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    avatar_url = Column(Text, nullable=True)
    fcm_token = Column(Text, nullable=True)
    preferred_checkin_time = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
