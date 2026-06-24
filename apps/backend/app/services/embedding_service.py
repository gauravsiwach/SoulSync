"""
Embedding service for generating text embeddings
"""
from typing import List
from app.core.config import get_settings
from app.core.llm_gateway import llm_gateway
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)

class EmbeddingService:
    def __init__(self):
        self.llm_gateway = llm_gateway
    
    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using the configured LLM provider"""
        try:
            if settings.AI_PROVIDER == "openai":
                return self._get_openai_embedding(text)
            else:
                # For Ollama, we'll need to use a different approach
                # For now, we'll use a simple placeholder or call Ollama's embedding API
                return self._get_ollama_embedding(text)
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise
    
    def _get_openai_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI"""
        try:
            import openai
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
            raise
    
    def _get_ollama_embedding(self, text: str) -> List[float]:
        """Generate embedding using Ollama"""
        try:
            import httpx
            
            # Ollama embedding endpoint
            url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
            
            response = httpx.post(
                url,
                json={
                    "model": settings.OLLAMA_EMBEDDING_MODEL,
                    "prompt": text
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("embedding", [])
            else:
                logger.error(f"Ollama embedding failed with status {response.status_code}")
                raise Exception(f"Ollama embedding failed: {response.text}")
        except Exception as e:
            logger.error(f"Ollama embedding failed: {e}")
            # Fallback: try OpenAI if available
            if settings.OPENAI_API_KEY:
                logger.warning("Falling back to OpenAI embeddings")
                return self._get_openai_embedding(text)
            else:
                # Last resort: return a zero vector
                logger.warning("Using zero vector as fallback embedding")
                return [0.0] * 1536  # Default to OpenAI dimensions

# Global embedding service instance
embedding_service = EmbeddingService()
