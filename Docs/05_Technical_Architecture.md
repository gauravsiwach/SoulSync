# SoulSync — Technical Architecture Document

## 1. Architecture Philosophy

### Design Principles
- **Companion-first latency**: Chat responses must feel conversational (<2s p95). Background intelligence runs async.
- **Memory is the product**: The value compounds over time. Memory architecture is the most critical subsystem.
- **Graceful degradation**: If the LLM is slow or unavailable, the system still delivers cached insights, scheduled nudges, and safety interventions.
- **Privacy by architecture**: User data is segmented per-user at the storage layer. No cross-user data leakage is possible by design.
- **Intervention reliability**: Risk detection and Trust Circle alerts are on a separate critical path — never blocked by chat load.

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│         React Native (iOS + Android) + Web (Future)             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────▼────────────────────────────────────┐
│                       API GATEWAY                                │
│   FastAPI + Uvicorn │ Auth Middleware │ Rate Limiter │ Router    │
└───┬──────────┬──────────┬──────────┬──────────┬────────────────┘
    │          │          │          │          │
┌───▼───┐ ┌───▼───┐ ┌────▼────┐ ┌──▼───┐ ┌───▼────┐
│ Chat  │ │Profile│ │ Goals   │ │Trust │ │Notif.  │
│Service│ │Service│ │ Service │ │Circle│ │Service │
└───┬───┘ └───┬───┘ └────┬────┘ └──┬───┘ └───┬────┘
    │          │          │          │          │
┌───▼──────────▼──────────▼──────────▼──────────▼────────────────┐
│                    AI ORCHESTRATION LAYER                        │
│         Agent Router │ LLM Gateway │ Prompt Engine               │
└───┬─────────────────────────────────────────────┬──────────────┘
    │                                             │
┌───▼──────────────────────┐  ┌───────────────────▼──────────────┐
│      MEMORY SYSTEM       │  │      INTELLIGENCE ENGINE          │
│  Qdrant │ PostgreSQL    │  │ Risk Scorer │ Pattern Detector    │
│  Redis │ Notifications │  │ Goal Analyzer │ Mood Tracker      │
└──────────────────────────┘  └──────────────────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  BACKGROUND WORKERS│
                              │  (Celery + Redis)  │
                              └────────────────────┘
```

---

## 3. Service Decomposition

### 3.1 Chat Service
**Responsibility**: Real-time conversational interface between user and AI companion.

| Concern | Decision |
|---------|----------|
| Protocol | WebSocket (persistent connection) with HTTP fallback for reconnection |
| Session management | Redis-backed session with 30-min TTL, auto-resume from last context |
| Streaming | Token-by-token streaming to client via WebSocket frames |
| Context window | Dynamically assembled per-message (profile + recent memory + retrieved episodes) |
| Fallback | If LLM timeout >5s, return empathetic acknowledgment + queue full response |

### 3.2 Profile Service
**Responsibility**: CRUD for all user profile dimensions — stored as a single unified record with JSONB fields for personality, emotional state, relationships, and preferences.

| Concern | Decision |
|---------|----------|
| Storage | PostgreSQL with JSONB for flexible schema evolution |
| Updates | Dual-write: explicit (user edits) + implicit (AI-inferred from conversations) |
| Access | Internal-only API; never exposed directly to client |

### 3.3 Goals Service
**Responsibility**: Goal creation, tracking, progress measurement, accountability logic.

| Concern | Decision |
|---------|----------|
| Model | Goal → Milestones → Check-ins (hierarchical) |
| Progress | Calculated from check-in frequency + self-reported + AI-inferred signals |
| Nudge calibration | Adjusts push intensity based on current emotional state (from Mood Tracker) |
| Integrations | Future: calendar, habit trackers. MVP: manual + conversation-based |

### 3.4 Trust Circle Service
**Responsibility**: Managing trusted contacts, alert rules, escalation workflows.

| Concern | Decision |
|---------|----------|
| Consent model | Bi-directional: user adds contact → contact must accept + configure preferences |
| Alert levels | Informational / Concern / Urgent / Emergency (maps to Risk Engine levels) |
| Delivery | SMS (Twilio) + Push notification + Email (tiered by urgency) |
| Privacy | Contacts receive templated messages only — never raw conversation data |
| Cooldown | Min 24h between alerts per contact (except Emergency) to prevent alert fatigue |

### 3.5 Notification Service
**Responsibility**: All outbound communication — proactive check-ins, nudges, Trust Circle alerts.

| Concern | Decision |
|---------|----------|
| Push | Firebase Cloud Messaging (cross-platform) |
| SMS | Twilio (Trust Circle emergency only) |
| Scheduling | Cron-based (daily check-in) + event-driven (risk threshold crossed) |
| Personalization | Tone/timing calibrated to user's personality profile + timezone + activity patterns |
| Quiet hours | User-configurable; Emergency overrides quiet hours |

---

## 4. AI Orchestration Layer

### 4.1 Agent Architecture

```
┌────────────────────────────────────────────┐
│              ORCHESTRATOR                    │
│  Intent Classification → Agent Routing      │
└─────┬─────┬─────┬─────┬─────┬─────────────┘
      │     │     │     │     │
┌─────▼┐ ┌──▼──┐ ┌▼───┐ ┌──▼──┐ ┌──▼───────┐
│Compan│ │Memo-│ │Goal│ │Risk │ │Interven- │
│ion   │ │ry   │ │    │ │     │ │tion      │
│Agent │ │Agent│ │Agen│ │Agent│ │Agent     │
└──────┘ └─────┘ └────┘ └─────┘ └──────────┘
```

### 4.2 Agent Responsibilities

| Agent | Trigger | Input | Output | Runs |
|-------|---------|-------|--------|------|
| **Orchestrator** | Every user message | Raw message + metadata | Routed intent + assembled context | Sync (per-message) |
| **Companion** | Chat interaction | Message + context + profile + mode | Conversational response | Sync |
| **Memory** | After every AI response | User msg + AI response + profile | Extracted facts, emotions, events → stored | Async (queued) |
| **Goal Coach** | Goal-related intent OR scheduled | Goal state + mood + motivation trend | Coaching response OR nudge content | Sync or Async |
| **Insight Generator** | Scheduled (daily) | Last 7 days of episodic memory + profile + mood tags + goal state | 3–5 actionable insight objects → stored | Async (background) |
| **Risk Monitor** | Scheduled (every 4h) + post-conversation | Accumulated signals over N days | Risk scores + intervention decision | Async |
| **Intervention** | Risk threshold crossed | Risk level + user profile + Trust Circle config | Alert routing + message composition | Async (critical path) |

### 4.3 Orchestrator Logic

**Intent Classification Taxonomy:**
- `emotional_support` → Companion (listen mode)
- `seeking_advice` → Companion (guide mode)
- `goal_related` → Goal Coach
- `crisis_signal` → Immediate Risk Assessment → possible Intervention
- `casual_chat` → Companion (friend mode)
- `relationship_update` → Companion + Memory (relationship graph update)

**Context Assembly Strategy:**
1. Pull user profile (structured, from Postgres)
2. Pull working memory (current session context, from Redis)
3. Semantic search over episodic memory (top-K relevant past interactions, from Qdrant)
4. Pull recent unsurfaced insights (max 2–3 relevant to current topic, from Postgres)
5. Assemble prompt with role instructions + personality adaptation + retrieved context
6. Enforce token budget: profile (500t) + working memory (500t) + episodic (1500t) + insights (200t) + conversation (2000t) + system (500t) = ~5200t context

### 4.4 LLM Gateway

| Concern | Decision |
|---------|----------|
| Primary model | GPT-4o (balance of quality + speed + cost) |
| Fallback model | GPT-4o-mini (if primary latency >3s or rate limited) |
| Embedding model | text-embedding-3-small (for vector memory) |
| Abstraction | Internal LLM Gateway service wraps all providers; agents never call OpenAI directly |
| Caching | Semantic cache (Redis) for near-duplicate queries within 1h window |
| Cost control | Per-user daily token budget with graceful degradation (shorter context, fewer retrievals) |

---

## 5. Memory Architecture

### 5.1 Memory Layers

```
┌─────────────────────────────────────────────────┐
│              WORKING MEMORY (Redis)              │
│  Current session │ Last 5 messages │ Active mood │
│  TTL: 30 min after last interaction             │
└─────────────────────────┬───────────────────────┘
                          │ promotes to ↓
┌─────────────────────────▼───────────────────────┐
│           EPISODIC MEMORY (Qdrant)               │
│  Conversation summaries │ Key moments │ Events  │
│  Searchable by semantic similarity              │
│  Retention: indefinite                          │
└─────────────────────────┬───────────────────────┘
                          │ distills into ↓
┌─────────────────────────▼───────────────────────┐
│          SEMANTIC MEMORY (PostgreSQL)            │
│  Profile facts │ Relationships │ Preferences    │
│  Personality model │ Goals │ Risk scores        │
│  Structured, queryable                          │
└─────────────────────────┬───────────────────────┘
                          │ analyzed by ↓
┌─────────────────────────▼───────────────────────┐
│          INSIGHT LAYER (PostgreSQL)              │
│  Periodic pattern observations │ Actionable     │
│  insights derived from all memory layers        │
│  Categories: mood_trend, goal_drift,            │
│  positive_pattern, relationship_observation     │
│  Refresh: daily via background worker           │
└─────────────────────────────────────────────────┘
```

### 5.2 Insight Generation Pipeline

A lightweight background capability that periodically analyzes accumulated user data and produces actionable observations. Not a separate service — implemented as a Celery task + LangGraph node within the existing Intelligence Engine.

**Schedule:** Daily (runs after mood/goal data is fresh from the day's interactions)

**Process:**
1. Gather last 7 days of episodic memory + current profile + mood tags + goal progress
2. Single LLM call (GPT-4o-mini — sufficient for pattern observation): "Given this user's recent data, generate 3–5 short actionable insights"
3. Store results in `user_insights` table
4. Mark previously surfaced insights as stale

**Insight Categories:**
| Category | Example |
|----------|---------|
| `mood_trend` | "You seem happier when spending time with friends" |
| `goal_drift` | "You haven't discussed your fitness goal recently" |
| `positive_pattern` | "Your energy peaks on days you journal in the morning" |
| `relationship_observation` | "Conversations about your sister tend to boost your mood" |
| `stress_pattern` | "Work stress appears highest on Mondays" |

**Consumers:**
- **Companion Agent** — weaves relevant insights naturally into conversation ("By the way, I've noticed...")
- **Goal Coach** — uses goal_drift insights to calibrate nudge timing and content
- **Notification Service** — surfaces insights as weekly digest or contextual nudge
- **Future Dashboard** — displays trends and patterns visually

**Design constraints:**
- Max 5 insights stored per user at any time (older ones archived)
- Each insight has a `surfaced: bool` flag — once shown to user, not repeated
- If generation fails, nothing breaks — insights are enrichment, not critical path
- No new infrastructure: same Celery worker pool, same Postgres, same LLM Gateway

### 5.3 Memory Extraction Pipeline

After each conversation turn:
1. **Fact Extraction** — LLM extracts structured facts (new job, breakup, moved cities, new friend)
2. **Emotion Tagging** — Classify emotional state + intensity for this interaction
3. **Relationship Updates** — Detect mentions of people → update relationship graph
4. **Goal Signals** — Detect progress/regression signals for active goals
5. **Contradiction Resolution** — If new fact contradicts stored fact, flag for confirmation or supersede with timestamp
6. **Summarization** — Every N turns, compress conversation into episodic summary for long-term storage

### 5.4 Memory Retrieval Strategy

| Query Type | Source | Method |
|------------|--------|--------|
| "What did we talk about yesterday?" | Episodic | Temporal filter + recency sort |
| User mentions a person by name | Semantic + Episodic | Relationship graph lookup + vector search for past mentions |
| User seems stressed | Episodic + Semantic | Pull recent mood trend + stress triggers from profile |
| Risk scoring (background) | All layers | Aggregate signals from last 7 days across all memory |

### 5.5 Storage Decisions

| Store | Technology | Why |
|-------|-----------|-----|
| Structured profiles | PostgreSQL 16 | ACID, JSONB flexibility, mature ecosystem |
| Episodic memory | Qdrant | Purpose-built vector search, rich payload filtering, easy self-hosting via Docker, gRPC + REST API |
| Session/cache/queues | Redis 7 | Sub-ms latency, TTL support, pub/sub for real-time events, Celery broker |
| File/media (future) | S3-compatible (MinIO or AWS S3) | Voice notes, images shared in chat |

---

## 6. Risk & Intervention Engine

### 6.1 Risk Scoring Model

```
┌──────────────────────────────────────────────────────┐
│                   SIGNAL SOURCES                       │
├──────────────────────────────────────────────────────┤
│ • Conversation sentiment (per-message emotion tags)   │
│ • Engagement patterns (frequency, time-of-day shifts) │
│ • Keyword/phrase detection (crisis language)           │
│ • Goal abandonment (missed check-ins)                 │
│ • Social mention decline (loneliness indicator)       │
│ • Self-reported mood from check-ins                   │
│ • Sudden behavioral changes (activity pattern breaks) │
└───────────────────────┬──────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────┐
│               RISK DIMENSIONS                         │
├──────────────────────────────────────────────────────┤
│ • Isolation Score (0-100)                             │
│ • Burnout Score (0-100)                               │
│ • Emotional Distress Score (0-100)                    │
│ • Crisis Probability (0-1.0)                          │
└───────────────────────┬──────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────┐
│            INTERVENTION LEVELS                         │
├──────────┬───────────┬────────────┬──────────────────┤
│   LOW    │  MEDIUM   │    HIGH    │    CRITICAL      │
│ Score<30 │ Score<60  │ Score<85   │   Score≥85       │
├──────────┼───────────┼────────────┼──────────────────┤
│Gentler   │Proactive  │Direct      │Trust Circle      │
│check-in  │check-in + │concern +   │alert + crisis    │
│tone      │resource   │escalation  │resources +       │
│          │suggestion │offer       │emergency info    │
└──────────┴───────────┴────────────┴──────────────────┘
```

### 6.2 Risk Engine Design Decisions

| Decision | Rationale |
|----------|-----------|
| Rule-based scoring for MVP | Interpretable, auditable, no training data needed. ML upgrade path later |
| 4-hour scoring cycle (background) | Balances responsiveness with compute cost |
| Real-time crisis keyword detection | Certain phrases bypass the scoring cycle entirely and trigger immediate assessment |
| Separate critical path for alerts | Risk detection → Trust Circle notification runs on dedicated worker pool, never starved by chat load |
| Human-in-the-loop for Critical | Critical level always routes through Trust Circle, never attempts autonomous crisis management |
| Score decay | Scores decay toward baseline over time if no new negative signals (prevents permanent high-risk labels) |

### 6.3 Safety Guardrails

- SoulSync never provides medical diagnosis or prescribes treatment
- Crisis detection always surfaces professional resources (hotlines, local services)
- Trust Circle alerts are factual ("We're concerned about [Name]'s wellbeing") — never share conversation content
- User can disable risk monitoring (but not crisis keyword detection — that's a non-negotiable safety floor)
- All intervention decisions are logged for review

---

## 7. Trust Circle Workflow

```
┌────────┐         ┌──────────┐        ┌─────────────┐
│  User  │ adds    │  System  │ sends  │  Contact    │
│        ├────────►│          ├───────►│  (Invited)  │
└────────┘         └──────────┘        └──────┬──────┘
                                              │ accepts
                                              ▼
                                       ┌──────────────┐
                                       │  Contact     │
                                       │  configures: │
                                       │  • Alert lvl │
                                       │  • Channel   │
                                       │  • Quiet hrs │
                                       └──────────────┘

═══════════ ALERT FLOW ═══════════

Risk Engine triggers alert
        │
        ▼
┌───────────────────┐     ┌──────────────────┐
│ Filter: Which     │     │ Compose message  │
│ contacts for this ├────►│ (templated,      │
│ alert level?      │     │  no raw data)    │
└───────────────────┘     └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │ Deliver via       │
                          │ preferred channel │
                          │ (Push/SMS/Email)  │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │ Log delivery +    │
                          │ track response    │
                          └──────────────────┘
```

**Key design decisions:**
- Contacts never get access to the app or user's data — they only receive outbound alerts
- User sees a log of all alerts sent on their behalf
- Contact can "acknowledge" an alert (confirms they reached out) — system tracks this
- If no contact acknowledges within 2h for Critical alerts → system escalates (re-sends, broader circle)

---

## 8. Data Architecture

### 8.1 Core Data Model (PostgreSQL)

```
users
├── user_profiles (1:1) — unified profile: basic info, personality, emotional state, relationships (JSONB)
├── conversations (1:N) → messages (1:N) — chat history
├── goals (1:N) → goal_checkins (1:N) — goal tracking
├── trust_circle_members (1:N) — contacts + their preferences
├── risk_scores (1:N, time-series) — historical risk snapshots
├── user_insights (1:N) — generated insights (category, text, confidence, surfaced flag, created_at)
└── notifications (1:N) — all outbound communications log
```

### 8.2 Vector Store Schema (per user namespace)

```
Collection: episodic_memory
├── id: UUID
├── user_id: UUID (partition key)
├── content: string (conversation summary or key moment)
├── embedding: vector[1536]
├── metadata:
│   ├── timestamp
│   ├── emotion_tags[]
│   ├── people_mentioned[]
│   ├── topics[]
│   └── importance_score (0-1)
└── ttl: null (indefinite retention)
```

### 8.3 Data Isolation

- Every query is scoped by `user_id` — enforced at the ORM/repository layer
- Qdrant uses payload-based filtering on `user_id` (single collection, filtered at query time) or per-user collections at scale
- Redis keys are prefixed with `user:{id}:`
- No shared collections, no cross-user analytics in MVP

---

## 9. Scalability Considerations

### 9.1 MVP Scale (0–10K users)

| Component | Deployment | Notes |
|-----------|-----------|-------|
| API + WebSocket | Single instance, 4 workers | FastAPI + Uvicorn handles ~5K concurrent WS connections |
| PostgreSQL | Single managed instance (RDS/Supabase) | Sufficient for 10K users |
| Redis | Single node (ElastiCache or managed) | Session + cache + queue broker |
| Qdrant | Single Docker container or Qdrant Cloud Free | <1M vectors at 10K users, minimal resource footprint |
| Workers | 2-3 Celery workers | Background scoring + memory extraction |
| LLM | OpenAI API (no self-hosting) | Pay-per-token, no infra burden |

### 9.2 Growth Scale (10K–500K users)

| Concern | Strategy |
|---------|----------|
| WebSocket connections | Horizontal API scaling behind load balancer + sticky sessions (or Redis pub/sub for WS fan-out) |
| Database | Read replicas for profile reads; partition risk_scores and messages by user_id |
| Vector DB | Qdrant distributed mode (sharding + replication) or Qdrant Cloud managed cluster |
| Workers | Auto-scaling worker pool; priority queues (critical > scoring > memory extraction) |
| LLM costs | Aggressive caching, shorter context for inactive users, batch processing for background agents |
| Real-time | Introduce message queue (RabbitMQ/SQS) between API and workers for backpressure handling |

### 9.3 Future Scale (500K+)

- Microservice decomposition (Chat, Memory, Risk, Notification as independent services)
- Event-driven architecture (Kafka) replacing direct service calls
- Self-hosted/fine-tuned models for cost optimization (companion model fine-tuned on anonymized interaction patterns)
- Sharded PostgreSQL or move to CockroachDB for horizontal write scaling
- CDN + edge caching for static profile data served to client

---

## 10. MVP vs. Future Architecture

### MVP (Month 1–3)

```
Monolith (FastAPI)
├── /chat (WebSocket)
├── /profile (REST)
├── /goals (REST)
├── /trust-circle (REST)
├── /notifications (internal)
└── /internal/agents (orchestration)

External: OpenAI API, Qdrant (Docker or Qdrant Cloud Free), Supabase Postgres, Redis Cloud Free, Firebase Push
```

**Characteristics:**
- Single deployable unit (simplicity)
- All agents in-process (LangGraph state machine)
- Synchronous memory extraction (acceptable at low scale)
- Rule-based risk scoring (no ML)
- Single region deployment

### Future (Month 6+)

```
Services:
├── chat-service (WebSocket, stateless)
├── memory-service (manages all memory operations)
├── intelligence-service (risk, patterns, insights)
├── notification-service (push, SMS, email)
├── trust-circle-service (contact management, alerts)
└── gateway (auth, routing, rate limiting)

Infrastructure:
├── Kafka (event bus)
├── Kubernetes (orchestration)
├── Fine-tuned companion model (latency + cost)
├── ML-based risk scoring (trained on interaction data)
└── Multi-region with data residency compliance
```

---

## 11. Security & Privacy Architecture

| Layer | Measure |
|-------|---------|
| Transit | TLS 1.3 everywhere; certificate pinning in mobile app |
| Storage | AES-256 encryption at rest for all databases |
| Auth | JWT (short-lived access + refresh tokens); OAuth2 social login optional |
| API | Rate limiting (per-user + global); input validation; output sanitization |
| LLM | No PII sent to LLM in identifiable form; user referenced by anonymous ID in prompts |
| Data access | Row-level security in Postgres; all queries scoped by authenticated user_id |
| Audit | Intervention actions logged in `notifications` table with type classification |
| Deletion | Hard delete capability (GDPR right-to-erasure); cascade across all stores including vector DB |
| Trust Circle | Zero-knowledge alerts: contacts learn concern level, never conversation content |

---

## 12. Observability & Reliability

| Concern | Tool/Approach |
|---------|--------------|
| API metrics | Prometheus + Grafana (latency, error rate, WS connections) |
| LLM observability | LangSmith or custom logging (token usage, latency, fallback rate) |
| Alerting | PagerDuty for Critical risk engine failures (life-safety implications) |
| Tracing | OpenTelemetry across all services (critical for debugging agent chains) |
| Uptime SLA | 99.9% for chat; 99.99% for risk detection pipeline (higher bar due to safety) |
| Chaos testing | Simulate LLM outage, DB failover, worker crash — validate graceful degradation |

---

## 13. Key Architecture Decisions Summary

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | Python/FastAPI over Node.js | Express, NestJS | AI ecosystem alignment; single-language for backend + ML |
| 2 | WebSocket for chat over polling | HTTP long-poll, SSE | Bi-directional, low-latency, streaming-friendly |
| 3 | Qdrant over Postgres pgvector | pgvector, Pinecone, Weaviate | Open-source, self-hostable via Docker, rich payload filtering, gRPC performance, no vendor lock-in |
| 4 | Celery+Redis over serverless functions | AWS Lambda, Cloud Functions | Persistent workers better for stateful scoring; lower cold-start latency |
| 5 | LangGraph over raw API calls | CrewAI, AutoGen, raw OpenAI | Deterministic state machine; better observability; no autonomy risks |
| 6 | Rule-based risk over ML (MVP) | Trained classifiers | No training data yet; interpretable; auditable for safety-critical decisions |
| 7 | Monolith-first over microservices | K8s microservices from day 1 | Faster iteration; team of 1-3 doesn't need distributed system complexity |
| 8 | Managed services over self-hosted | Self-hosted everything | Minimize ops burden for small team; migrate to self-hosted when cost demands it |
| 9 | User-namespaced memory over shared | Global vector collection | Privacy by default; no accidental cross-user retrieval; simpler deletion |
| 10 | Bi-directional Trust Circle consent | Unilateral alert setup | Ethical requirement; prevents abuse; builds trust with contacts |

---

## 14. Open Questions for Product Decision

1. **Data retention policy** — How long do we keep raw conversations? Indefinite vs. auto-summarize-and-delete after N months?
2. **Offline support** — Should the app work without internet (local cache of recent conversations)?
3. **Multi-device sync** — MVP: single device? Future: sync across devices?
4. **Professional handoff** — Should we integrate with therapist platforms for warm handoffs from Critical risk?
5. **Voice input** — Out of scope for MVP, but architecture should not preclude adding speech-to-text later.
6. **Regulatory classification** — Is SoulSync a "wellness app" or a "medical device"? This changes data handling requirements significantly.

---

## 15. Future Scope (Post-MVP)

The following capabilities were considered during architecture design but intentionally deferred to keep the MVP lean and shippable. They are documented here to inform future development.

### 15.1 Dedicated `personality_profiles` Table

| | |
|---|---|
| **Description** | Separate table for communication style, decision-making patterns, motivational drivers, and social preferences — currently stored as JSONB within `user_profiles` |
| **Why Deferred** | MVP doesn't query personality data independently. JSONB in `user_profiles` is sufficient until we need cross-user personality analytics or structured personality assessments |
| **Future Value** | Enables personality-based matching (community features), structured psychological profiling, and personality-aware recommendation engines |

### 15.2 Dedicated `emotional_profiles` Table

| | |
|---|---|
| **Description** | Separate table for mood baselines, emotional triggers, stress thresholds, and coping patterns |
| **Why Deferred** | Emotional data is currently derived from conversation analysis and stored as JSONB fields. No independent queries needed in MVP |
| **Future Value** | Enables longitudinal emotional health tracking, therapist-facing dashboards, and ML-based emotional prediction models |

### 15.3 Dedicated `relationships` Table

| | |
|---|---|
| **Description** | Normalized table for people in the user's life — name, relationship type, sentiment history, interaction frequency |
| **Why Deferred** | MVP tracks relationships as a JSONB array in `user_profiles`. No relational queries across users' relationship graphs needed yet |
| **Future Value** | Relationship graph traversal, social network health scoring, relationship-aware conversation context, and potential "shared circles" features |

### 15.4 Intervention Audit System

| | |
|---|---|
| **Description** | Dedicated `interventions` table logging every system-initiated action (risk alerts, proactive check-ins, escalations) with full decision trace |
| **Why Deferred** | MVP logs interventions as notification records with a type field. Sufficient for tracking what was sent and when |
| **Future Value** | Regulatory compliance, intervention effectiveness analytics, decision audit trails for safety review boards, and ML training data for intervention timing optimization |

### 15.5 Event Log / Event Sourcing

| | |
|---|---|
| **Description** | Append-only event log capturing all state changes (profile updates, risk score changes, memory writes) for replay and analytics |
| **Why Deferred** | Adds storage overhead and implementation complexity with no direct user-facing benefit in MVP. Current tables provide sufficient operational data |
| **Future Value** | Enables event replay for debugging, CQRS architecture migration, real-time analytics pipelines, and complete system state reconstruction |

### 15.6 Profile Version History

| | |
|---|---|
| **Description** | Snapshot-based versioning of user profiles — capturing how the AI's understanding of a user evolves over time |
| **Why Deferred** | No MVP feature requires historical profile states. Current profile is always the latest and that's all the companion agent needs |
| **Future Value** | "How has the AI's understanding of me changed?" user-facing feature, regression detection in AI inference quality, and research into personality evolution |

### 15.7 Relationship Graph Database

| | |
|---|---|
| **Description** | Graph database (Neo4j or similar) for modeling complex relationship networks — family trees, social circles, professional networks |
| **Why Deferred** | Introduces new infrastructure. MVP relationship data is flat (list of people + type). No graph traversal queries needed |
| **Future Value** | Social health scoring, "Who should I reconnect with?" features, relationship conflict detection, and community/group features |

### 15.8 Advanced Analytics Tables

| | |
|---|---|
| **Description** | Denormalized tables optimized for analytics queries — engagement metrics, feature usage, cohort analysis, retention tracking |
| **Why Deferred** | MVP tracks success via simple product metrics (conversation count, goal check-in frequency). No data warehouse needed yet |
| **Future Value** | Product-led growth decisions, investor reporting, A/B test infrastructure, and user segmentation for personalized onboarding |

---

## 16. MVP Scope Freeze

The current architecture and database design represent the **approved MVP scope**.

**Included in MVP:**
- 10 PostgreSQL tables (users, user_profiles, conversations, messages, goals, goal_checkins, trust_circle_members, risk_scores, user_insights, notifications)
- 1 Qdrant collection (episodic_memory)
- 5 Redis key patterns (sessions, chat context, profile cache, goals cache, insights cache + Celery queues)
- FastAPI monolith with LangGraph orchestration
- OpenAI API for LLM and embeddings
- Celery + Redis for background processing
- Rule-based risk engine
- Trust Circle alerting
- Insight generation

**All Future Scope items (Section 15) are intentionally deferred.** They should not be implemented, partially scaffolded, or "prepared for" in the MVP codebase. When the time comes, they will be designed and implemented based on real usage data and validated product needs — not speculative architecture.

Building less, faster, is the strategy.
