# SoulSync — Database Design (MVP)

## 1. Database Overview

### Storage Philosophy
Each storage technology handles what it does best. No overlap, no redundancy.

| Store | Role | What Lives Here |
|-------|------|-----------------|
| **PostgreSQL** | System of record | All structured application data — users, profiles, goals, conversations, risk, trust circle |
| **Qdrant** | Semantic memory | Episodic conversation memories — vector embeddings for retrieval-augmented generation |
| **Redis** | Ephemeral runtime | Sessions, active chat context, background job queues, short-lived cache |

### Design Constraints
- No table exists without a direct MVP feature requiring it
- No versioning, auditing, or analytics tables
- No graph relationships or advanced AI metadata
- PostgreSQL uses JSONB where structured-but-flexible data is needed (avoiding premature schema rigidity)
- Qdrant stores only what needs semantic search — everything else stays in Postgres
- Redis stores only what needs sub-millisecond access or has a TTL — everything else stays in Postgres

---

## 2. PostgreSQL Design

### 2.1 Table Inventory

#### `users`

| | |
|---|---|
| **Purpose** | Authentication identity and account state |
| **Ownership** | Auth system |
| **Relationships** | Parent of all other tables (every table references `users.id`) |
| **Why MVP** | Cannot have a product without user accounts |

---

#### `user_profiles`

| | |
|---|---|
| **Purpose** | Stores the AI's evolving understanding of the user — personality, emotional baseline, preferences, life context |
| **Ownership** | Profile Service + Memory Agent (AI-inferred updates) |
| **Relationships** | 1:1 with `users` |
| **Why MVP** | The companion needs structured knowledge about the user to personalize responses. Without this, every conversation starts from zero. |

---

#### `conversations`

| | |
|---|---|
| **Purpose** | Groups messages into logical conversation sessions |
| **Ownership** | Chat Service |
| **Relationships** | N:1 with `users`, 1:N with `messages` |
| **Why MVP** | Needed to organize chat history, resume sessions, and feed the memory extraction pipeline |

---

#### `messages`

| | |
|---|---|
| **Purpose** | Individual chat messages (user + AI) with metadata |
| **Ownership** | Chat Service |
| **Relationships** | N:1 with `conversations` |
| **Why MVP** | Raw conversation record. Source for memory extraction, mood tagging, and conversation display in the UI. |

---

#### `goals`

| | |
|---|---|
| **Purpose** | User-defined goals the AI tracks and coaches toward |
| **Ownership** | Goals Service + Goal Coach Agent |
| **Relationships** | N:1 with `users`, 1:N with `goal_checkins` |
| **Why MVP** | Goal accountability is a core product feature. The AI references active goals during conversations. |

---

#### `goal_checkins`

| | |
|---|---|
| **Purpose** | Progress check-in records against a goal (self-reported or AI-inferred) |
| **Ownership** | Goals Service |
| **Relationships** | N:1 with `goals` |
| **Why MVP** | Without check-ins, goal tracking has no data. The Goal Coach uses check-in frequency and recency to calibrate nudges. |

---

#### `trust_circle_members`

| | |
|---|---|
| **Purpose** | Trusted contacts who receive alerts when risk thresholds are crossed |
| **Ownership** | Trust Circle Service |
| **Relationships** | N:1 with `users` |
| **Why MVP** | Core safety feature. Risk engine needs to know who to alert and how. |

---

#### `risk_scores`

| | |
|---|---|
| **Purpose** | Periodic risk assessment snapshots (isolation, burnout, distress, crisis probability) |
| **Ownership** | Risk Monitor Agent (background worker) |
| **Relationships** | N:1 with `users` (time-series — multiple scores per user over time) |
| **Why MVP** | Powers the intervention system. Historical scores show trends (improving/worsening). Trust Circle alerts trigger based on these scores. |

---

#### `user_insights`

| | |
|---|---|
| **Purpose** | AI-generated pattern observations surfaced to the user ("You seem happier after hiking") |
| **Ownership** | Insight Generator (background worker) |
| **Relationships** | N:1 with `users` |
| **Why MVP** | Makes the companion feel intelligent. Demonstrates the "it understands me" magic moment without requiring complex real-time analysis. |

---

#### `notifications`

| | |
|---|---|
| **Purpose** | Record of all outbound notifications — proactive check-ins, nudges, Trust Circle alerts |
| **Ownership** | Notification Service |
| **Relationships** | N:1 with `users` |
| **Why MVP** | Tracks what was sent, when, and delivery status. Prevents duplicate sends. User can see notification history. Trust Circle alert audit trail. |

---

### 2.2 What Is NOT a Separate Table (and why)

| Data | Where It Lives | Rationale |
|------|---------------|-----------|
| Personality profile | JSONB in `user_profiles` | Evolving schema; not queried independently |
| Emotional profile | JSONB in `user_profiles` | Same — AI updates this progressively |
| Relationships (people in user's life) | JSONB in `user_profiles` | MVP doesn't need relational queries on relationships |
| Goal milestones | JSONB array in `goals` | Milestones are just sub-items; no independent queries needed |
| Mood tags per message | JSONB in `messages` | Attached metadata, not a standalone entity |
| Intervention log | Filtered view of `notifications` (type = intervention) | Same delivery mechanism, same audit need |

---

## 3. Qdrant Design

### 3.1 Collection Structure

**Single collection:** `episodic_memory`

One collection for all users. User isolation enforced via payload filtering on `user_id`.

### 3.2 What Gets Stored

Each point (vector) represents one **episodic memory unit** — a compressed summary of a conversation segment or a significant moment extracted by the Memory Agent.

**Stored as vectors:**
- Conversation turn summaries (every 3-5 turns, compressed into one memory)
- Key life events mentioned ("got promoted", "broke up with partner", "moved to a new city")
- Emotional peaks (moments of high joy, distress, or vulnerability)

**NOT stored in Qdrant:**
- Raw messages (stay in Postgres)
- Structured profile facts (stay in Postgres)
- Goals, risk scores, notifications (stay in Postgres)

### 3.3 Point Schema

```
{
  "id": "uuid",
  "vector": [1536-dim float array],  // text-embedding-3-small output
  "payload": {
    "user_id": "uuid",
    "content": "Summary text of the memory",
    "timestamp": "ISO-8601",
    "emotion_tags": ["happy", "anxious"],
    "people_mentioned": ["sister", "boss"],
    "topics": ["work", "relationship"],
    "importance": 0.8,
    "conversation_id": "uuid",
    "surfaced_count": 0
  }
}
```

### 3.4 Retrieval Strategy

| Use Case | Query Approach |
|----------|---------------|
| Chat context assembly | Semantic search (embed user's message → find top-5 relevant memories) filtered by `user_id` |
| "What did we talk about last week?" | Filter by `user_id` + `timestamp` range, sort by recency |
| Person-related context | Filter by `user_id` + `people_mentioned` contains name, then semantic rank |
| Risk scoring (background) | Filter by `user_id` + `timestamp` last 7 days, retrieve all (no semantic query needed) |
| Insight generation | Same as risk scoring — bulk retrieve recent memories for pattern analysis |

### 3.5 Indexing Configuration

- Distance metric: **Cosine similarity**
- Index type: **HNSW** (default, good for <1M points in MVP)
- Payload indexes: `user_id` (keyword), `timestamp` (integer/range), `people_mentioned` (keyword)

---

## 4. Redis Design

### 4.1 Session Storage

**Key pattern:** `session:{user_id}`
**Content:** JWT session metadata, last-active timestamp, device info
**TTL:** 30 minutes (sliding — reset on each interaction)

### 4.2 Active Chat Context (Working Memory)

**Key pattern:** `chat_context:{user_id}`
**Content:** JSON object containing:
- Last 5 messages (user + AI) for immediate context
- Current detected mood
- Active conversation_id
- Any pending follow-up topics

**TTL:** 30 minutes after last message (auto-expires idle sessions)

### 4.3 Queue Usage (Celery Broker)

Redis serves as the Celery message broker for background tasks:

| Queue | Tasks |
|-------|-------|
| `default` | Memory extraction, insight generation, non-urgent profile updates |
| `critical` | Risk scoring, Trust Circle alert delivery |

Two queues only. Priority separation ensures safety-critical tasks never queue behind bulk work.

### 4.4 Cache Usage

| Key Pattern | Content | TTL |
|-------------|---------|-----|
| `profile:{user_id}` | Cached user profile (avoid Postgres read on every message) | 5 minutes |
| `goals:{user_id}` | Active goals summary | 5 minutes |
| `insights:{user_id}` | Current unsurfaced insights | 1 hour |

### 4.5 TTL Strategy Summary

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Sessions | 30 min sliding | Standard session timeout |
| Chat context | 30 min from last message | Matches session lifecycle |
| Profile cache | 5 min | Short enough to pick up AI-inferred updates quickly |
| Goals cache | 5 min | Goals don't change often but should reflect new check-ins |
| Insights cache | 1 hour | Generated daily, rarely stale |
| Queue messages | No TTL (consumed immediately) | Workers process and remove |

---

## 5. Entity Relationship Overview

```
users
 ├── user_profiles         (1:1)
 ├── conversations         (1:N)
 │    └── messages         (1:N)
 ├── goals                 (1:N)
 │    └── goal_checkins    (1:N)
 ├── trust_circle_members  (1:N)
 ├── risk_scores           (1:N, time-series)
 ├── user_insights         (1:N)
 └── notifications         (1:N)
```

All relationships are simple parent-child. No many-to-many. No self-referential joins. No cross-entity foreign keys beyond `user_id`.

---

## 6. Data Flow Between Systems

### 6.1 Chat Flow (per message)

```
User Message
    │
    ▼
[Redis] Read chat_context:{user_id}          ← working memory
    │
    ▼
[Redis] Read profile:{user_id} cache         ← structured context
    │ (cache miss → Postgres read → cache fill)
    ▼
[Qdrant] Semantic search top-5 memories      ← episodic context
    │
    ▼
[LLM] Generate response with assembled context
    │
    ▼
[Postgres] Write message to messages table   ← persist
    │
    ▼
[Redis] Update chat_context:{user_id}        ← refresh working memory
    │
    ▼
[Redis/Celery] Enqueue memory extraction     ← async processing
```

### 6.2 Memory Extraction Flow (async, post-message)

```
[Celery Worker] Picks up task from queue
    │
    ▼
[LLM] Extract facts, emotions, events from recent messages
    │
    ├──► [Qdrant] Upsert new episodic memory point
    ├──► [Postgres] Update user_profiles (AI-inferred changes)
    └──► [Redis] Invalidate profile:{user_id} cache
```

### 6.3 Background Scoring Flow (scheduled)

```
[Celery Beat] Triggers risk scoring task
    │
    ▼
[Qdrant] Retrieve last 7 days of memories for user
    │
    ▼
[Postgres] Read current profile + recent goal_checkins
    │
    ▼
[Worker] Calculate risk scores (rule-based)
    │
    ▼
[Postgres] Insert new risk_scores row
    │
    ├──► (if threshold crossed) [Postgres] Read trust_circle_members
    └──► (if threshold crossed) [Postgres] Insert notification + trigger delivery
```

---

## 7. MVP Storage Responsibility Matrix

| Data | PostgreSQL | Qdrant | Redis |
|------|:---:|:---:|:---:|
| User identity & auth | ✓ | | |
| User profile (structured) | ✓ | | cache |
| Raw messages | ✓ | | |
| Episodic memories (vectors) | | ✓ | |
| Goals & check-ins | ✓ | | cache |
| Trust Circle contacts | ✓ | | |
| Risk scores | ✓ | | |
| Insights | ✓ | | cache |
| Notifications | ✓ | | |
| Active chat context | | | ✓ |
| Session state | | | ✓ |
| Background job queue | | | ✓ |

**Rule of thumb:**
- If it needs to survive a restart → **Postgres**
- If it needs semantic search → **Qdrant**
- If it needs sub-ms access or expires → **Redis**
