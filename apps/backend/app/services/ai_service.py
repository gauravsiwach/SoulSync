import os
import json
import httpx
import time
from typing import AsyncGenerator, List, Dict, Optional
from openai import AsyncOpenAI
from app.core.config import get_settings
from app.core.logging import get_logger, log_ai_request, log_ai_response, log_redis_operation, log_error
import redis

settings = get_settings()
logger = get_logger(__name__)

class AIService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        
        # Initialize AI provider
        if settings.AI_PROVIDER == "ollama":
            self.use_openai = False
            self.ollama_client = httpx.AsyncClient(
                base_url=settings.OLLAMA_BASE_URL,
                timeout=60.0  # Increase timeout to 60 seconds for Ollama
            )
        else:
            self.use_openai = True
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
    async def get_conversation_context(self, user_id: str) -> List[Dict[str, str]]:
        """Retrieve conversation history from Redis"""
        context_key = f"conversation:{user_id}"
        start_time = time.time()
        try:
            history = self.redis_client.lrange(context_key, 0, -1)
            duration_ms = (time.time() - start_time) * 1000
            log_redis_operation("lrange", context_key, duration_ms, message_count=len(history))
            logger.info("conversation_context_retrieved", user_id=user_id, message_count=len(history))
            return [json.loads(msg) for msg in history]
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            log_redis_operation("lrange", context_key, duration_ms, error=str(e))
            log_error(e, {"user_id": user_id, "operation": "get_conversation_context"})
            return []
    
    async def store_message(self, user_id: str, role: str, content: str):
        """Store message in Redis conversation history"""
        context_key = f"conversation:{user_id}"
        message = {"role": role, "content": content}
        
        # Add to Redis list (keep last 20 messages)
        self.redis_client.lpush(context_key, json.dumps(message))
        self.redis_client.ltrim(context_key, 0, 19)
        
        # Set expiration (24 hours)
        self.redis_client.expire(context_key, 86400)
    
    async def get_discovery_questions(self) -> str:
        """Generate discovery questions using AI for first-time users"""
        discovery_prompt = """You are SoulSync, a compassionate AI mental health companion. 
Generate a warm, welcoming message with 3-4 gentle discovery questions for a first-time user.
Keep it under 150 words and make it feel personal and caring."""

        try:
            if self.use_openai:
                response = await self.openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a compassionate mental health AI companion."},
                        {"role": "user", "content": discovery_prompt}
                    ],
                    max_tokens=200,
                    temperature=0.7
                )
                return response.choices[0].message.content.strip()
            else:
                # Use Ollama for discovery questions
                try:
                    request_payload = {
                        "model": settings.OLLAMA_MODEL,
                        "prompt": discovery_prompt,
                        "stream": False
                    }
                    
                    logger.info("ollama_request", 
                        model=settings.OLLAMA_MODEL, 
                        url=settings.OLLAMA_BASE_URL + "/api/generate",
                        request_payload=request_payload
                    )
                    
                    response = await self.ollama_client.post(
                        "/api/generate",
                        json=request_payload
                    )
                    
                    logger.info("ollama_response", 
                        status=response.status_code,
                        headers=dict(response.headers)
                    )
                    
                    result = response.json()
                    
                    logger.info("ollama_response_data", 
                        response=result,
                        response_text=result.get("response", ""),
                        done=result.get("done", False)
                    )
                    
                    return result.get("response", "").strip()
                except Exception as ollama_error:
                    logger.error("ollama_api_error", 
                        error=str(ollama_error),
                        error_type=type(ollama_error).__name__
                    )
                    raise ollama_error
        except Exception as e:
            logger.error("Failed to generate discovery questions", error)
            # Fallback to simple message
            return "Hello! I'm your SoulSync companion. How are you feeling today, and what brought you here?"
    
    async def is_first_session(self, user_id: str) -> bool:
        """Check if this is the user's first session"""
        session_key = f"first_session:{user_id}"
        return not self.redis_client.exists(session_key)
    
    async def mark_first_session_complete(self, user_id: str):
        """Mark first session as complete"""
        session_key = f"first_session:{user_id}"
        self.redis_client.setex(session_key, 86400 * 30, "complete")  # 30 days
    
    async def chat_completion_stream(
        self, 
        user_id: str, 
        message: str
    ) -> AsyncGenerator[str, None]:
        """Generate streaming chat completion with context"""
        
        logger.info("chat_completion_started", user_id=user_id, message_length=len(message))
        
        # Get conversation history
        conversation_history = await self.get_conversation_context(user_id)
        
        # Check if first session and add discovery questions if needed
        is_first = await self.is_first_session(user_id)
        if is_first and len(conversation_history) == 0:
            logger.info("generating_discovery_questions", user_id=user_id, provider=settings.AI_PROVIDER)
            discovery_questions = await self.get_discovery_questions()
            logger.info("discovery_questions_generated", user_id=user_id, response_length=len(discovery_questions))
            yield discovery_questions
            await self.store_message(user_id, "assistant", discovery_questions)
            await self.mark_first_session_complete(user_id)
            return
        
        # Store user message
        await self.store_message(user_id, "user", message)
        
        logger.info("generating_regular_ai_response", user_id=user_id, provider=settings.AI_PROVIDER)
        
        # Prepare messages for OpenAI
        messages = [
            {
                "role": "system",
                "content": """You are SoulSync, a compassionate AI mental health companion. You are:
- Supportive and empathetic
- Focused on emotional well-being
- Encouraging but not giving medical advice
- Able to remember previous conversations
- Gentle and caring in your responses

Respond naturally and conversationally. Be warm and understanding."""
            }
        ]
        
        # Add conversation history (last 10 messages to stay within token limits)
        for msg in conversation_history[-10:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add current user message
        messages.append({
            "role": "user", 
            "content": message
        })
        
        try:
            start_time = time.time()
            provider = "openai" if self.use_openai else "ollama"
            model = "gpt-3.5-turbo" if self.use_openai else settings.OLLAMA_MODEL
            
            log_ai_request(user_id, provider, model, len(message))
            
            if self.use_openai:
                # OpenAI streaming
                stream = await self.openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=messages,
                    stream=True,
                    max_tokens=500,
                    temperature=0.7
                )
                
                full_response = ""
                async for chunk in stream:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        yield content
                
            else:
                # Ollama streaming
                ollama_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages]
                
                async with self.ollama_client.stream(
                    "/api/chat",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "messages": ollama_messages,
                        "stream": True
                    }
                ) as response:
                    full_response = ""
                    async for line in response.aiter_lines():
                        if line.strip():
                            try:
                                chunk_data = json.loads(line)
                                if "message" in chunk_data and "content" in chunk_data["message"]:
                                    content = chunk_data["message"]["content"]
                                    full_response += content
                                    yield content
                            except json.JSONDecodeError:
                                continue
            
            # Store assistant response
            await self.store_message(user_id, "assistant", full_response)
            
            # Log AI response
            duration_ms = (time.time() - start_time) * 1000
            log_ai_response(user_id, provider, len(full_response), duration_ms)
            logger.info("chat_completion_completed", user_id=user_id, response_length=len(full_response), duration_ms=duration_ms)
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            error_msg = "I'm having trouble connecting right now. Please try again in a moment."
            log_error(e, {"user_id": user_id, "operation": "chat_completion_stream", "duration_ms": duration_ms})
            logger.error("chat_completion_failed", user_id=user_id, error=str(e))
            yield error_msg
            await self.store_message(user_id, "assistant", error_msg)

# Global AI service instance
ai_service = AIService()
