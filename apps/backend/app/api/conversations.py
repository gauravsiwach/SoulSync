from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from uuid import UUID
from datetime import datetime

from app.db.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.core.security import get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/conversations")
async def create_conversation(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new conversation for the current user"""
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Creating new conversation for user: {user_id}")
        
        # Check if this is the first conversation
        existing_conversations = db.query(Conversation).filter(
            Conversation.user_id == UUID(user_id)
        ).all()
        
        is_first_conversation = len(existing_conversations) == 0
        
        conversation = Conversation(
            user_id=UUID(user_id),
            is_first_conversation=is_first_conversation,
            status='active',
            started_at=datetime.utcnow()
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        logger.info(f"Created conversation {conversation.id} for user {user_id}")
        
        return {
            "id": str(conversation.id),
            "user_id": str(conversation.user_id),
            "started_at": conversation.started_at.isoformat() if conversation.started_at else None,
            "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
            "status": conversation.status,
            "is_first_conversation": conversation.is_first_conversation
        }
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )


@router.get("/conversations")
async def get_conversations(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all conversations for the current user"""
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Fetching conversations for user: {user_id}")
        
        conversations = db.query(Conversation).filter(
            Conversation.user_id == UUID(user_id)
        ).order_by(desc(Conversation.last_message_at)).all()
        
        logger.info(f"Found {len(conversations)} conversations")
        
        # Add message count for each conversation
        conversations_with_count = []
        for conv in conversations:
            message_count = db.query(Message).filter(
                Message.conversation_id == conv.id
            ).count()
            
            conversations_with_count.append({
                "id": str(conv.id),
                "user_id": str(conv.user_id),
                "started_at": conv.started_at.isoformat() if conv.started_at else None,
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "status": conv.status,
                "is_first_conversation": conv.is_first_conversation,
                "message_count": message_count
            })
        
        return {
            "conversations": conversations_with_count
        }
    except Exception as e:
        logger.error(f"Error fetching conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations"
        )


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all messages for a specific conversation"""
    try:
        user_id = current_user.get("user_id")
        logger.info(f"Fetching messages for conversation: {conversation_id}, user: {user_id}")
        
        # Verify conversation belongs to user
        conversation = db.query(Conversation).filter(
            Conversation.id == UUID(conversation_id),
            Conversation.user_id == UUID(user_id)
        ).first()
        
        if not conversation:
            logger.warning(f"Conversation {conversation_id} not found for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        # Get messages
        messages = db.query(Message).filter(
            Message.conversation_id == UUID(conversation_id)
        ).order_by(Message.created_at).all()
        
        logger.info(f"Found {len(messages)} messages for conversation {conversation_id}")
        
        return {
            "conversation_id": conversation_id,
            "is_first_conversation": conversation.is_first_conversation,
            "messages": [
                {
                    "id": str(msg.id),
                    "conversation_id": str(msg.conversation_id),
                    "role": msg.role,
                    "content": msg.content,
                    "mood_tag": msg.mood_tag,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None
                }
                for msg in messages
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversation messages"
        )
