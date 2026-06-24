from openai import OpenAI
from typing import AsyncGenerator, Dict, Any, Optional
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class LLMGateway:
    def __init__(self):
        settings = get_settings()
        self.settings = settings
        self.provider = settings.AI_PROVIDER.lower()
        
        if self.provider == "ollama":
            self.primary_client = OpenAI(
                base_url=f"{settings.OLLAMA_BASE_URL}/v1",
                api_key="ollama"
            )
            self.primary_model = settings.OLLAMA_MODEL
            self.fallback_model = settings.OLLAMA_MODEL
            logger.info("llm_gateway_initialized", provider="ollama", model=self.primary_model, base_url=settings.OLLAMA_BASE_URL)
        else:
            self.primary_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            self.primary_model = "gpt-4o"
            self.fallback_model = "gpt-4o-mini"
            logger.info("llm_gateway_initialized", provider="openai", model=self.primary_model)
    
    async def generate_completion(
        self,
        messages: list,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False
    ) -> AsyncGenerator[str, None]:
        """
        Generate completion using OpenAI API with streaming support
        Primary: GPT-4o, Fallback: GPT-4o-mini
        """
        use_model = model or self.primary_model
        
        try:
            logger.info(f"llm_request_started", model=use_model, message_count=len(messages))
            
            if stream:
                async for chunk in self._stream_completion(messages, use_model, temperature, max_tokens):
                    yield chunk
            else:
                response = self.primary_client.chat.completions.create(
                    model=use_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                yield response.choices[0].message.content
                
        except Exception as e:
            logger.error(f"llm_primary_failed", model=use_model, error=str(e))
            
            # Try fallback model
            if use_model == self.primary_model:
                logger.info(f"llm_fallback_attempt", model=self.fallback_model)
                try:
                    if stream:
                        async for chunk in self._stream_completion(messages, self.fallback_model, temperature, max_tokens):
                            yield chunk
                    else:
                        response = self.primary_client.chat.completions.create(
                            model=self.fallback_model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=max_tokens
                        )
                        yield response.choices[0].message.content
                except Exception as fallback_error:
                    logger.error(f"llm_fallback_failed", model=self.fallback_model, error=str(fallback_error))
                    raise Exception(f"Both primary and fallback LLM models failed: {str(e)}, {str(fallback_error)}")
            else:
                raise e
    
    async def _stream_completion(
        self,
        messages: list,
        model: str,
        temperature: float,
        max_tokens: Optional[int]
    ) -> AsyncGenerator[str, None]:
        """Internal streaming implementation"""
        try:
            response = self.primary_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"llm_stream_error", model=model, error=str(e))
            raise
    
    def get_completion_sync(
        self,
        messages: list,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Synchronous completion for non-streaming use cases
        """
        use_model = model or self.primary_model
        
        try:
            logger.info(f"llm_sync_request_started", model=use_model)
            
            response = self.primary_client.chat.completions.create(
                model=use_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            content = response.choices[0].message.content
            logger.info(f"llm_sync_request_completed", model=use_model, content_length=len(content))
            return content
            
        except Exception as e:
            logger.error(f"llm_sync_failed", model=use_model, error=str(e))
            
            # Try fallback
            if use_model == self.primary_model:
                logger.info(f"llm_sync_fallback_attempt", model=self.fallback_model)
                try:
                    response = self.primary_client.chat.completions.create(
                        model=self.fallback_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens
                    )
                    return response.choices[0].message.content
                except Exception as fallback_error:
                    logger.error(f"llm_sync_fallback_failed", model=self.fallback_model, error=str(fallback_error))
                    raise Exception(f"Both primary and fallback LLM models failed: {str(e)}, {str(fallback_error)}")
            else:
                raise e

# Global LLM gateway instance
llm_gateway = LLMGateway()
