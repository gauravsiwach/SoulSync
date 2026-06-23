import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.ai_service import ai_service
from app.core.logging import get_logger, log_api_request, log_api_response, log_error

logger = get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    message: str
    user_id: str

class ChatResponse(BaseModel):
    response: str
    user_id: str

@router.post("/stream")
async def chat_stream(message: ChatMessage):
    """Streaming chat endpoint for real-time AI responses"""
    
    start_time = time.time()
    log_api_request("POST", "/chat/stream", message.user_id, message_length=len(message.message))
    
    if not message.user_id:
        logger.warning("chat_stream_missing_user_id")
        raise HTTPException(status_code=400, detail="user_id is required")
    
    if not message.message.strip():
        logger.warning("chat_stream_empty_message", user_id=message.user_id)
        raise HTTPException(status_code=400, detail="message cannot be empty")
    
    logger.info("chat_stream_started", user_id=message.user_id, message_length=len(message.message))
    
    async def generate_response():
        try:
            async for chunk in ai_service.chat_completion_stream(
                user_id=message.user_id,
                message=message.message
            ):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            error_msg = "I'm having trouble connecting right now. Please try again."
            log_error(e, {"user_id": message.user_id, "endpoint": "/chat/stream"})
            logger.error("chat_stream_error", user_id=message.user_id, error=str(e))
            yield f"data: {error_msg}\n\n"
        finally:
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate_response(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )

@router.post("/message", response_model=ChatResponse)
async def chat_message(message: ChatMessage):
    """Non-streaming chat endpoint for testing"""
    
    if not message.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    if not message.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")
    
    try:
        # Collect full response from stream
        full_response = ""
        async for chunk in ai_service.chat_completion_stream(
            user_id=message.user_id,
            message=message.message
        ):
            full_response += chunk
        
        return ChatResponse(
            response=full_response,
            user_id=message.user_id
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}")
async def get_chat_history(user_id: str):
    """Get conversation history for a user"""
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    try:
        history = await ai_service.get_conversation_context(user_id)
        return {"user_id": user_id, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{user_id}")
async def clear_chat_history(user_id: str):
    """Clear conversation history for a user"""
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    try:
        # Delete conversation history
        ai_service.redis_client.delete(f"conversation:{user_id}")
        # Reset first session flag
        ai_service.redis_client.delete(f"first_session:{user_id}")
        
        return {"message": "Chat history cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
