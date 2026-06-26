import os
import json
import time
from typing import AsyncGenerator, List, Dict, Optional, Any
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.llm_gateway import llm_gateway
from app.core.prompts import DISCOVERY_SYSTEM_PROMPT, REGULAR_COMPANION_PROMPT, GOAL_COACH_SYSTEM_PROMPT
from app.services.redis_service import redis_service
from app.services.memory_extraction_service import should_extract_memory, extract_memory_from_conversation
from app.services.qdrant_service import qdrant_service
from app.services.embedding_service import embedding_service
from app.db.database import get_db
from app.models.user_profile import UserProfile
from app.models.goal import Goal
from app.models.goal_checkin import GoalCheckin
from sqlalchemy.orm import Session

settings = get_settings()
logger = get_logger(__name__)

class AIService:
    def __init__(self):
        self.llm_gateway = llm_gateway
        self.redis_service = redis_service
    
    def get_user_profile_context(self, user_id: str, db: Session) -> str:
        """Get user profile context for AI responses"""
        try:
            from uuid import UUID
            profile = db.query(UserProfile).filter(
                UserProfile.user_id == UUID(user_id)
            ).first()
            
            if profile:
                context = f"""
User Profile:
- Name: {profile.name or 'Not provided'}
- Age Range: {profile.age_range or 'Not provided'}
- Occupation: {profile.occupation or 'Not provided'}
- Location: {profile.location or 'Not provided'}
- Relationship Status: {profile.relationship_status or 'Not provided'}
- Interests: {', '.join(profile.interests) if profile.interests else 'Not provided'}
- Personal Goals: {profile.personal_goals or 'Not provided'}
"""
                return context
            else:
                return "No profile information available."
        except Exception as e:
            logger.error("error_fetching_user_profile", user_id=user_id, error=str(e))
            return "No profile information available."
    
    def get_goal_context(self, user_id: str, db: Session) -> str:
        """Get active goals and recent check-ins context for AI responses"""
        try:
            from uuid import UUID
            active_goals = db.query(Goal).filter(
                Goal.user_id == UUID(user_id),
                Goal.status == 'active'
            ).limit(3).all()
            
            if not active_goals:
                return ""
            
            context = "\n\nActive Goals:\n"
            for goal in active_goals:
                context += f"- {goal.title}"
                if goal.description:
                    context += f": {goal.description}"
                if goal.category:
                    context += f" (Category: {goal.category})"
                if goal.target_date:
                    context += f" (Target: {goal.target_date})"
                context += "\n"
                
                # Get last 3 check-ins for this goal
                checkins = db.query(GoalCheckin).filter(
                    GoalCheckin.goal_id == goal.id
                ).order_by(GoalCheckin.created_at.desc()).limit(3).all()
                
                if checkins:
                    context += "  Recent check-ins:\n"
                    for checkin in checkins:
                        context += f"  - Score: {checkin.progress_score}/5"
                        if checkin.note:
                            context += f", Note: {checkin.note}"
                        context += f" ({checkin.created_at.strftime('%Y-%m-%d')})\n"
            
            return context
        except Exception as e:
            logger.error("error_fetching_goal_context", user_id=user_id, error=str(e))
            return ""
    
    async def get_chat_context(self, user_id: str) -> List[Dict[str, str]]:
        """Retrieve conversation history from Redis"""
        return self.redis_service.get_chat_context(user_id)
    
    async def store_message(self, user_id: str, role: str, content: str):
        """Store message in Redis conversation history"""
        message = {"role": role, "content": content}
        self.redis_service.append_message_to_context(user_id, message)
    
    async def chat_completion_stream(
        self, 
        user_id: str, 
        message: str,
        is_first_conversation: bool = False,
        conversation_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> AsyncGenerator[str, None]:
        """Generate streaming chat completion with context"""
        
        logger.info("chat_completion_started", user_id=user_id, message_length=len(message), is_first_conversation=is_first_conversation, conversation_id=conversation_id)
        
        # Get conversation history
        conversation_history = await self.get_chat_context(user_id)
        
        # Store user message
        await self.store_message(user_id, "user", message)
        
        # Select system prompt based on conversation type
        if is_first_conversation and len(conversation_history) == 0:
            system_prompt = DISCOVERY_SYSTEM_PROMPT
            logger.info("using_discovery_prompt", user_id=user_id)
        else:
            system_prompt = REGULAR_COMPANION_PROMPT
            logger.info("using_regular_companion_prompt", user_id=user_id)
        
        # Prepare messages for LLM
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add user profile context if available
        if db:
            profile_context = self.get_user_profile_context(user_id, db)
            if profile_context != "No profile information available.":
                messages.append({
                    "role": "system",
                    "content": f"Here's what you know about the user:\n{profile_context}"
                })
            
            # Add goal context if available
            goal_context = self.get_goal_context(user_id, db)
            if goal_context:
                messages.append({
                    "role": "system",
                    "content": f"Here's what I know about their goals:\n{goal_context}"
                })
        
        # Add retrieved memories (RAG) if not first conversation
        if not is_first_conversation:
            memory_context = await self._retrieve_relevant_memories(user_id, message)
            if memory_context:
                messages.append({
                    "role": "system",
                    "content": f"What I remember about you:\n{memory_context}"
                })
        
        # Add conversation history (last 10 messages)
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
            full_response = ""
            
            # Stream response from LLM gateway
            async for chunk in self.llm_gateway.generate_completion(
                messages=messages,
                stream=True,
                temperature=0.7
            ):
                full_response += chunk
                yield chunk
            
            # Store assistant response
            await self.store_message(user_id, "assistant", full_response)
            
            # Trigger memory extraction if needed (async, non-blocking)
            if conversation_id and should_extract_memory(user_id, conversation_id):
                import asyncio
                asyncio.create_task(self._trigger_memory_extraction(
                    user_id, conversation_id, conversation_history, message, full_response
                ))
            
            # Log completion
            duration_ms = (time.time() - start_time) * 1000
            logger.info("chat_completion_completed", user_id=user_id, response_length=len(full_response), duration_ms=duration_ms)
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            error_msg = "I'm having trouble connecting right now. Please try again in a moment."
            logger.error("chat_completion_failed", user_id=user_id, error=str(e))
            yield error_msg
            await self.store_message(user_id, "assistant", error_msg)
    
    async def _retrieve_relevant_memories(self, user_id: str, query: str) -> str:
        """Retrieve relevant memories from Qdrant using RAG"""
        try:
            # Generate embedding for the query
            query_embedding = embedding_service.get_embedding(query)
            
            # Search for relevant memories
            memories = qdrant_service.search_memories(
                user_id=user_id,
                query_embedding=query_embedding,
                limit=5,
                min_score=0.7
            )
            
            if not memories:
                return ""
            
            # Format memories as context
            memory_context = ""
            for i, memory in enumerate(memories, 1):
                memory_context += f"{i}. {memory['content']}\n"
            
            logger.info(f"retrieved_memories", user_id=user_id, count=len(memories))
            return memory_context
            
        except Exception as e:
            logger.error(f"memory_retrieval_failed", user_id=user_id, error=str(e))
            return ""
    
    async def _trigger_memory_extraction(
        self,
        user_id: str,
        conversation_id: str,
        conversation_history: List[Dict[str, str]],
        user_message: str,
        assistant_response: str
    ):
        """Trigger async memory extraction"""
        try:
            # Build conversation text for extraction
            conversation_text = ""
            for msg in conversation_history[-10:]:
                conversation_text += f"{msg['role']}: {msg['content']}\n"
            conversation_text += f"user: {user_message}\n"
            conversation_text += f"assistant: {assistant_response}\n"
            
            # Extract memory (runs in background)
            import time
            timestamp = int(time.time())
            result = await extract_memory_from_conversation(
                user_id=user_id,
                conversation_id=conversation_id,
                conversation_text=conversation_text,
                timestamp=timestamp
            )
            
            if result.get("success"):
                logger.info("memory_extraction_triggered_successfully", user_id=user_id, point_id=result.get("point_id"))
            else:
                logger.error("memory_extraction_triggered_failed", user_id=user_id, error=result.get("error"))
        except Exception as e:
            logger.error("memory_extraction_task_failed", user_id=user_id, error=str(e))

    def generate_insights(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate insights from user data using LLM"""
        import asyncio
        try:
            # Build insight generation prompt
            prompt = f"""
You are an insight generator for a personal growth app. Analyze the user's data from the last 7 days and generate 3-5 meaningful insights.

User Data:
- Memories: {json.dumps(context.get('memories', []), indent=2)}
- Message count: {context.get('message_count', 0)}
- Check-in count: {context.get('checkin_count', 0)}
- Recent check-ins: {json.dumps(context.get('recent_checkins', []), indent=2)}

Generate insights in the following JSON format:
[
  {{
    "category": "mood_trend|goal_drift|positive_pattern|area_of_growth",
    "content": "Specific insight based on the data",
    "confidence": 0.0-1.0
  }}
]

Guidelines:
- Keep insights specific and actionable
- Focus on patterns and trends
- Be encouraging but realistic
- Avoid repeating similar insights
- Maximum 5 insights
"""

            # generate_completion is an async generator - collect all chunks in a thread
            from concurrent.futures import ThreadPoolExecutor

            def run_async_in_thread():
                async def collect_response():
                    chunks = []
                    async for chunk in self.llm_gateway.generate_completion(
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.7
                    ):
                        chunks.append(chunk)
                    return "".join(chunks)

                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    return new_loop.run_until_complete(collect_response())
                finally:
                    new_loop.close()

            with ThreadPoolExecutor() as executor:
                future = executor.submit(run_async_in_thread)
                response = future.result()
            
            # Log raw response for debugging
            logger.info("llm_raw_response", response=str(response)[:500] if response else "empty")
            
            # Strip markdown code blocks if present
            if response:
                response = response.strip()
                if response.startswith("```"):
                    response = response.split("```", 2)[1]
                    if response.startswith("json"):
                        response = response[4:]
                    response = response.strip()
                if response.endswith("```"):
                    response = response.rsplit("```", 1)[0].strip()
            
            # Parse JSON response
            try:
                insights = json.loads(response)
                if not isinstance(insights, list):
                    insights = [insights]
                
                # Validate and format insights
                formatted_insights = []
                for insight in insights[:5]:  # Max 5 insights
                    if isinstance(insight, dict):
                        formatted_insights.append({
                            "category": insight.get("category", "general"),
                            "content": insight.get("content", ""),
                            "confidence": insight.get("confidence", 0.8)
                        })
                
                logger.info("insights_generated", count=len(formatted_insights))
                return formatted_insights
                
            except json.JSONDecodeError as e:
                logger.error("insight_json_parse_failed", error=str(e))
                return []
                
        except Exception as e:
            logger.error("insight_generation_failed", error=str(e))
            return []

# Global AI service instance
ai_service = AIService()
