from sqlalchemy import Column, String, DateTime, Text, Time, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    # Phase 1: Authentication & User Profile
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    provider = Column(String, nullable=False)  # 'google' | 'apple'
    provider_id = Column(String, nullable=False)
    display_name = Column(String, nullable=True)  # User's display name from OAuth
    avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Phase 5: Notifications & Personalization
    fcm_token = Column(Text, nullable=True)  # Firebase Cloud Messaging token
    preferred_checkin_time = Column(Time, nullable=True)  # User's preferred daily check-in time
    
    # Phase 6: Risk Detection & Trust Circle Settings
    settings = Column(JSON, nullable=True, default=dict)  # User settings as JSON
