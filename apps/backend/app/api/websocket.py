from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict
from jose import JWTError, jwt
from app.db.database import get_db
from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.ai_service import ai_service
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user_profile import UserProfile
from uuid import UUID
import json
import asyncio

logger = get_logger(__name__)
router = APIRouter()
settings = get_settings()

def verify_websocket_token(token: str, db: Session) -> dict:
    """Manually verify JWT token for WebSocket connections"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
        
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None:
            logger.error("jwt_token_invalid_no_subject")
            return None
        
        logger.info("jwt_token_verified", user_id=user_id, email=email)
        
        return {
            "user_id": user_id,
            "email": email
        }
        
    except JWTError as e:
        logger.error("jwt_token_verification_failed", error=str(e))
        return None

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"websocket_connected", user_id=user_id)
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"websocket_disconnected", user_id=user_id)
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/chat/{user_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...),
    conversation_id: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for streaming chat responses
    Token frames: {"type": "token", "content": "..."} per chunk
    End frame: {"type": "end"} on completion
    conversation_id: optional - if provided, use existing; if null/missing, create new
    """
    try:
        # Verify JWT token
        current_user = verify_websocket_token(token, db)
        if not current_user or str(current_user.get("user_id")) != user_id:
            logger.warning(f"websocket_auth_failed", user_id=user_id)
            await websocket.close(code=1008, reason="Unauthorized")
            return
        
        # Connect WebSocket
        await manager.connect(websocket, user_id)
        
        # Determine conversation
        if conversation_id:
            # Use specified conversation
            try:
                conversation = db.query(Conversation).filter(
                    Conversation.id == UUID(conversation_id),
                    Conversation.user_id == UUID(user_id)
                ).first()
                if not conversation:
                    logger.warning(f"conversation_not_found", conversation_id=conversation_id, user_id=user_id)
                    await websocket.close(code=1008, reason="Conversation not found")
                    return
                is_first_conversation = conversation.is_first_conversation
                logger.info(f"existing_conversation_used", user_id=user_id, conversation_id=conversation_id)
            except ValueError:
                logger.warning(f"invalid_conversation_id", conversation_id=conversation_id)
                await websocket.close(code=1008, reason="Invalid conversation ID")
                return
        else:
            # Require conversation_id - do not auto-create
            logger.warning(f"websocket_connection_without_conversation_id", user_id=user_id)
            await websocket.close(code=1008, reason="Conversation ID required")
            return
        
        conversation_id = str(conversation.id)
        
        # Clear Redis context for first conversations to ensure discovery prompt triggers
        if is_first_conversation:
            from app.services.redis_service import redis_service
            redis_service.clear_chat_context(user_id)
            logger.info(f"cleared_chat_context_for_first_conversation", user_id=user_id, conversation_id=conversation_id)
        
        # Send conversation ID to client
        await websocket.send_json({
            "type": "conversation_id",
            "conversation_id": conversation_id,
            "is_first_conversation": is_first_conversation
        })
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "message":
                    user_message = data.get("content", "")
                    
                    if not user_message:
                        continue
                    
                    logger.info(f"websocket_message_received", user_id=user_id, message_length=len(user_message))
                    
                    # Store user message in database
                    user_msg = Message(
                        conversation_id=UUID(conversation_id),
                        role="user",
                        content=user_message
                    )
                    db.add(user_msg)
                    db.commit()
                    
                    # Stream AI response
                    full_response = ""
                    async for chunk in ai_service.chat_completion_stream(
                        user_id=user_id,
                        message=user_message,
                        is_first_conversation=is_first_conversation,
                        db=db
                    ):
                        full_response += chunk
                        await websocket.send_json({
                            "type": "token",
                            "content": chunk
                        })
                    
                    # Store assistant response in database
                    assistant_msg = Message(
                        conversation_id=UUID(conversation_id),
                        role="assistant",
                        content=full_response
                    )
                    db.add(assistant_msg)
                    
                    # Update conversation last_message_at
                    conversation.last_message_at = conversation.last_message_at
                    db.commit()
                    
                    # Send end frame
                    await websocket.send_json({
                        "type": "end",
                        "content": full_response
                    })
                    
                    logger.info(f"websocket_response_completed", user_id=user_id, response_length=len(full_response))
                
                elif message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
            except WebSocketDisconnect:
                logger.info(f"websocket_disconnected_normally", user_id=user_id)
                break
            except Exception as e:
                logger.error(f"websocket_error", user_id=user_id, error=str(e))
                await websocket.send_json({
                    "type": "error",
                    "message": "An error occurred processing your message"
                })
                
    except WebSocketDisconnect:
        logger.info(f"websocket_disconnected_early", user_id=user_id)
    except Exception as e:
        logger.error(f"websocket_connection_error", user_id=user_id, error=str(e))
    finally:
        manager.disconnect(user_id)
