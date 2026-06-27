"""
Memory Extraction Service - Celery task for extracting and storing memories
"""
import time
import json
from typing import Dict, Any
from celery import Celery
from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.qdrant_service import qdrant_service
from app.services.embedding_service import embedding_service
from app.core.llm_gateway import llm_gateway
from app.core.prompts import MEMORY_EXTRACTION_PROMPT
from app.db.database import SessionLocal
from app.models.user_profile import UserProfile
from app.models.message import Message
from sqlalchemy.orm import Session
import openai

settings = get_settings()
logger = get_logger(__name__)

async def extract_memory_from_conversation(
    user_id: str,
    conversation_id: str,
    conversation_text: str,
    timestamp: int
) -> Dict[str, Any]:
    """
    Extract memory from conversation and store in Qdrant
    This is called by the Celery worker
    """
    try:
        logger.info(f"memory_extraction_started", user_id=user_id, conversation_id=conversation_id, conversation_text_length=len(conversation_text))
        
        # Call LLM for memory extraction
        extraction_prompt = MEMORY_EXTRACTION_PROMPT.format(conversation_text=conversation_text)
        logger.info(f"memory_extraction_prompt_created", user_id=user_id, prompt_length=len(extraction_prompt))
        
        # Use llm_gateway for extraction (supports both OpenAI and Ollama)
        extraction_result = ""
        logger.info(f"memory_extraction_calling_llm", user_id=user_id)
        
        # Call LLM asynchronously
        async for chunk in llm_gateway.generate_completion(
            messages=[{"role": "user", "content": extraction_prompt}],
            stream=False,
            temperature=0.3
        ):
            extraction_result += chunk
        
        # Log the raw LLM response for debugging
        logger.info(f"memory_extraction_llm_response", user_id=user_id, response_length=len(extraction_result), response=extraction_result)
        
        # Parse JSON response
        try:
            # Try to extract JSON from the response (handles markdown code blocks)
            json_start = extraction_result.find('{')
            json_end = extraction_result.rfind('}')
            
            if json_start != -1 and json_end != -1:
                json_str = extraction_result[json_start:json_end + 1]
                logger.info(f"memory_extraction_extracted_json", user_id=user_id, json_str=json_str[:500])
                memory_data = json.loads(json_str)
            else:
                logger.info(f"memory_extraction_no_json_brackets", user_id=user_id, response=extraction_result[:200])
                memory_data = json.loads(extraction_result)
        except json.JSONDecodeError as e:
            logger.error(f"memory_extraction_json_parse_failed", user_id=user_id, error=str(e), result=extraction_result[:500])
            # Fallback: create minimal memory
            memory_data = {
                "facts": [],
                "emotions": [],
                "people_mentioned": [],
                "topics": [],
                "summary": conversation_text[:200]  # Use first 200 chars as fallback
            }
        
        # Generate embedding for the summary
        summary = memory_data.get("summary", "")
        embedding = embedding_service.get_embedding(summary)
        
        # Store in Qdrant
        # Generate a unique integer point ID from timestamp and user_id hash
        import hashlib
        point_id_str = f"{user_id}_{conversation_id}_{timestamp}"
        point_id_int = int(hashlib.md5(point_id_str.encode()).hexdigest()[:15], 16)
        
        point_id = qdrant_service.upsert_memory(
            user_id=user_id,
            content=summary,
            embedding=embedding,
            metadata={
                "point_id_str": point_id_str,
                "timestamp": timestamp,
                "emotion_tags": memory_data.get("emotions", []),
                "people_mentioned": memory_data.get("people_mentioned", []),
                "topics": memory_data.get("topics", []),
                "importance": 1.0,  # Can be calculated later
                "conversation_id": conversation_id
            },
            point_id=point_id_int
        )
        
        # Update user profile with extracted facts
        db = SessionLocal()
        try:
            profile = db.query(UserProfile).filter(
                UserProfile.user_id == user_id
            ).first()
            
            if profile:
                # Merge new facts with existing ai_profile
                existing_facts = profile.ai_profile.get("facts", []) if profile.ai_profile else []
                new_facts = memory_data.get("facts", [])
                
                # Add only new facts (simple deduplication)
                for fact in new_facts:
                    if fact not in existing_facts:
                        existing_facts.append(fact)
                
                # Update ai_profile
                if not profile.ai_profile:
                    profile.ai_profile = {}
                profile.ai_profile["facts"] = existing_facts
                profile.ai_profile["last_updated"] = timestamp
                
                db.commit()
                logger.info(f"memory_extraction_profile_updated", user_id=user_id, facts_count=len(existing_facts))
            
            # Update mood_tag on the last user message
            mood_tag = memory_data.get("mood_tag")
            logger.info("mood_tag_extraction_attempt", user_id=user_id, mood_tag=mood_tag, memory_data_keys=list(memory_data.keys()))
            
            if mood_tag:
                last_user_message = db.query(Message).filter(
                    Message.conversation_id == conversation_id,
                    Message.role == "user"
                ).order_by(Message.created_at.desc()).first()
                
                if last_user_message:
                    last_user_message.mood_tag = mood_tag
                    db.commit()
                    logger.info("mood_tag_updated", user_id=user_id, message_id=str(last_user_message.id), mood_tag=mood_tag)
                else:
                    logger.warning("mood_tag_update_failed_no_user_message", user_id=user_id, conversation_id=conversation_id)
            else:
                logger.warning("mood_tag_not_found_in_memory_data", user_id=user_id, memory_data=memory_data)
        finally:
            db.close()
        
        logger.info(f"memory_extraction_completed", user_id=user_id, point_id=point_id)
        
        return {
            "success": True,
            "point_id": point_id,
            "memory_data": memory_data
        }
        
    except Exception as e:
        logger.error(f"memory_extraction_failed", user_id=user_id, error=str(e))
        return {
            "success": False,
            "error": str(e)
        }

def should_extract_memory(user_id: str, conversation_id: str) -> bool:
    """
    Check if memory should be extracted for this conversation
    Currently: extract every 5 USER messages in a conversation
    """
    try:
        from app.models.message import Message
        db = SessionLocal()
        
        try:
            # Count only user messages in this conversation
            user_message_count = db.query(Message).filter(
                Message.conversation_id == conversation_id,
                Message.role == "user"
            ).count()
            
            # Extract every 2 user messages for better risk monitoring
            should_extract = (user_message_count % 2 == 0 and user_message_count > 0)
            
            logger.info(f"memory_extraction_check", user_id=user_id, conversation_id=conversation_id, 
                       user_message_count=user_message_count, should_extract=should_extract)
            
            return should_extract
        finally:
            db.close()
    except Exception as e:
        logger.error(f"memory_extraction_check_failed", error=str(e))
        return False
