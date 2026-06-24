"""
Qdrant service for vector storage and retrieval
"""
from typing import List, Dict, Optional, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)

class QdrantService:
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.collection_name = "episodic_memory"
        self.vector_size = 384  # all-minilm embedding dimensions
        
    def initialize_collection(self):
        """Initialize the episodic_memory collection if it doesn't exist"""
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            if self.collection_name not in collection_names:
                logger.info(f"Creating Qdrant collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    ),
                    optimizers_config={
                        "indexing_threshold": 20000
                    }
                )
                
                # Create payload indexes
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="user_id",
                    field_schema="keyword"
                )
                
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="timestamp",
                    field_schema="integer"
                )
                
                logger.info(f"Qdrant collection {self.collection_name} created successfully")
            else:
                logger.info(f"Qdrant collection {self.collection_name} already exists")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant collection: {e}")
            raise
    
    def upsert_memory(
        self,
        user_id: str,
        content: str,
        embedding: List[float],
        metadata: Dict[str, Any],
        point_id: Optional[int] = None
    ) -> str:
        """Upsert a memory point to Qdrant"""
        try:
            if point_id is None:
                # Generate integer point ID from timestamp
                import hashlib
                point_id_str = f"{user_id}_{metadata.get('timestamp', 0)}"
                point_id = int(hashlib.md5(point_id_str.encode()).hexdigest()[:15], 16)
            
            point = PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "user_id": user_id,
                    "content": content,
                    "timestamp": metadata.get("timestamp", 0),
                    "emotion_tags": metadata.get("emotion_tags", []),
                    "people_mentioned": metadata.get("people_mentioned", []),
                    "topics": metadata.get("topics", []),
                    "importance": metadata.get("importance", 1.0),
                    "conversation_id": metadata.get("conversation_id", ""),
                    "surfaced_count": 0
                }
            )
            
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            
            logger.info(f"Upserted memory point {point_id} for user {user_id}")
            return point_id
            
        except Exception as e:
            logger.error(f"Failed to upsert memory: {e}")
            raise
    
    def search_memories(
        self,
        user_id: str,
        query_embedding: List[float],
        limit: int = 5,
        min_score: float = 0.3
    ) -> List[Dict[str, Any]]:
        """Search for relevant memories using vector similarity"""
        try:
            logger.info(f"search_memories_started", user_id=user_id, collection_name=self.collection_name, limit=limit)
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=limit
                # score_threshold=min_score  # Temporarily disabled for debugging
            )
            logger.info(f"search_memories_completed", user_id=user_id, result_count=len(search_result))
            
            memories = []
            for result in search_result:
                memories.append({
                    "content": result.payload["content"],
                    "timestamp": result.payload["timestamp"],
                    "emotion_tags": result.payload.get("emotion_tags", []),
                    "people_mentioned": result.payload.get("people_mentioned", []),
                    "topics": result.payload.get("topics", []),
                    "importance": result.payload.get("importance", 1.0),
                    "conversation_id": result.payload.get("conversation_id", ""),
                    "score": result.score,
                    "surfaced_count": result.payload.get("surfaced_count", 0)
                })
            
            logger.info(f"Found {len(memories)} memories for user {user_id}")
            return memories
            
        except Exception as e:
            logger.error(f"Failed to search memories: {e}")
            raise
    
    def increment_surfaced_count(self, point_id: str):
        """Increment the surfaced_count for a memory point"""
        try:
            self.client.set_payload(
                collection_name=self.collection_name,
                payload={"surfaced_count": 1},
                points=[point_id]
            )
        except Exception as e:
            logger.error(f"Failed to increment surfaced count: {e}")
    
    def get_user_memory_count(self, user_id: str) -> int:
        """Get the total number of memories for a user"""
        try:
            count_result = self.client.count(
                collection_name=self.collection_name,
                count_filter=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id)
                        )
                    ]
                )
            )
            return count_result.count
        except Exception as e:
            logger.error(f"Failed to get memory count: {e}")
            return 0

# Global Qdrant service instance
qdrant_service = QdrantService()
