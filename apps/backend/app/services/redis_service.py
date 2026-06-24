import redis
import json
from typing import List, Optional, Dict, Any
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class RedisService:
    def __init__(self):
        settings = get_settings()
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5
        )
        self._test_connection()
    
    def _test_connection(self):
        """Test Redis connection"""
        try:
            self.redis_client.ping()
            logger.info("redis_connection_successful")
        except Exception as e:
            logger.error("redis_connection_failed", error=str(e))
    
    def get_chat_context(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get chat context for a user from Redis
        Returns last 10 messages as working memory
        """
        try:
            context_key = f"chat_context:{user_id}"
            context_data = self.redis_client.get(context_key)
            
            if context_data:
                messages = json.loads(context_data)
                logger.info(f"retrieved_chat_context", user_id=user_id, message_count=len(messages))
                return messages
            else:
                logger.info(f"no_chat_context_found", user_id=user_id)
                return []
        except Exception as e:
            logger.error("error_retrieving_chat_context", user_id=user_id, error=str(e))
            return []
    
    def set_chat_context(self, user_id: str, messages: List[Dict[str, Any]], ttl: int = 1800):
        """
        Store chat context for a user in Redis
        TTL: 30 minutes (1800 seconds)
        """
        try:
            context_key = f"chat_context:{user_id}"
            # Keep only last 10 messages
            recent_messages = messages[-10:] if len(messages) > 10 else messages
            context_data = json.dumps(recent_messages)
            
            self.redis_client.setex(context_key, ttl, context_data)
            logger.info(f"stored_chat_context", user_id=user_id, message_count=len(recent_messages), ttl=ttl)
        except Exception as e:
            logger.error("error_storing_chat_context", user_id=user_id, error=str(e))
    
    def append_message_to_context(self, user_id: str, message: Dict[str, Any], ttl: int = 1800):
        """
        Append a single message to the chat context
        """
        try:
            current_context = self.get_chat_context(user_id)
            current_context.append(message)
            self.set_chat_context(user_id, current_context, ttl)
            logger.info(f"appended_message_to_context", user_id=user_id)
        except Exception as e:
            logger.error("error_appending_message_to_context", user_id=user_id, error=str(e))
    
    def clear_chat_context(self, user_id: str):
        """
        Clear chat context for a user
        """
        try:
            context_key = f"chat_context:{user_id}"
            self.redis_client.delete(context_key)
            logger.info(f"cleared_chat_context", user_id=user_id)
        except Exception as e:
            logger.error("error_clearing_chat_context", user_id=user_id, error=str(e))
    
    def get_conversation_count(self, user_id: str) -> int:
        """
        Get the number of messages in the current chat context
        """
        try:
            context = self.get_chat_context(user_id)
            return len(context)
        except Exception as e:
            logger.error("error_getting_conversation_count", user_id=user_id, error=str(e))
            return 0

# Global Redis service instance
redis_service = RedisService()
