# 09 — MVP Implementation Plan

> **SoulSync** · Solo founder · ~7–9 weeks total

---

## Planning Decisions (Locked)

| Topic | Decision |
|-------|----------|
| Team | Solo founder |
| Auth | Google + Apple OAuth |
| Trust Circle | Simplified one-way alerts — no bi-directional consent |
| Discovery Conversation | AI-led first session with structured questions (`is_first_conversation` flag) |
| Home Screen | Chat entry + insight card + mood summary |
| Push Notifications | Phase 5–6 only |
| Cold Start | Friendly empty states |

---

## Phase 0 — Development Foundation
**Duration:** 2–3 days · **Complexity:** Low

### Backend Tasks ✅ COMPLETED
- ✅ Repository setup: `.gitignore` for Python, Node.js, and IDE files
- ✅ Python virtual environment setup for local development (`apps/backend/venv`)
- ✅ Podman Compose: `postgres:16`, `redis:7`, `qdrant/qdrant`, `backend`, `celery-worker`
- ✅ FastAPI skeleton (`apps/backend/`) with `/health` and `/health/detailed` endpoints
- ✅ Alembic + 10-table migration scaffold (PKs, FKs, timestamps only — no business columns yet)
- ✅ Celery worker placeholder (`celery_worker.py`) wired to Redis broker
- ✅ `Dockerfile`, `entrypoint.sh`, `requirements.txt`
- ✅ Database models: 10 core tables with proper relationships and indexes
- ✅ Alembic migration applied successfully (20ac7135f306)

### Mobile Tasks ✅ COMPLETED
- ✅ Expo TypeScript project at `apps/mobile/` initialised with `expo-router`
- ✅ Folder structure per guidelines:
  ```
  apps/mobile/
  ├── app/              ← expo-router entry (index + _layout)
  ├── components/
  ├── stores/
  ├── services/
  ├── hooks/
  ├── types/
  └── assets/
  ```
- ✅ `package.json` with core deps: `expo`, `expo-router`, `react-native`, `typescript`, `zustand`, `@tanstack/react-query`
- ✅ `tsconfig.json` (strict mode), `app.json`, `.eslintrc.js`, `.prettierrc`, `babel.config.js`
- ✅ Placeholder `app/index.tsx` that renders `<Text>SoulSync</Text>` — confirms simulator launch
- ✅ Dependencies installed via `npm install`

### Root Tasks ✅ COMPLETED
- ✅ Repository structure: `apps/`, `packages/`, `infra/`, `docs/`, `.github/`
- ✅ Configuration files: `Makefile`, `.env.example`, `README.md`
- ✅ Development tools: `podman-compose` for container management
- ✅ Port configuration: PostgreSQL (5433), Redis (6380), Qdrant (6334) to avoid conflicts

### Acceptance Criteria ✅ VERIFIED
- ✅ All 5 services (`postgres`, `redis`, `qdrant`, `backend`, `celery`) start with `podman compose up`
- ✅ `GET /health` returns `200 OK`
- ✅ Expo app structure ready for iOS simulator (requires Xcode setup)

---

## 🎉 **Phase 0 Status: 100% COMPLETE**
**All development foundation tasks successfully completed and tested.**

---

## Phase 1 — Auth & User Profile
**Duration:** 4–5 days · **Complexity:** Medium

### Frontend
- Login screen (Google + Apple buttons)
- Onboarding form
  - **Required:** Name, Age Range, Occupation, Relationship Status
  - **Optional:** Interests, Personal Goals, Trusted Contact
- **Welcome Screen** — SoulSync introduction shown immediately after onboarding form submission
- Profile screen (view + edit)
- Zustand auth store; JWT persisted in `SecureStore`

### Backend
- `POST /auth/google` — server-side ID token verification → upsert user → return JWT
- `POST /auth/apple` — server-side ID token verification → upsert user → return JWT
- JWT middleware (all subsequent routes protected)
- `GET /profile/me`, `PUT /profile/me`, `POST /profile/onboarding`

### Database
```sql
users (
  id UUID PK,
  email TEXT UNIQUE,
  provider TEXT,          -- 'google' | 'apple'
  provider_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

user_profiles (
  id UUID PK,
  user_id UUID FK → users,
  name TEXT,
  age_range TEXT,
  occupation TEXT,
  location TEXT,
  relationship_status TEXT,
  interests TEXT[],
  ai_profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### User Journey Alignment
- Optional "Personal Goals" during onboarding → create stub row in `goals` table (status=`active`, no check-ins)
- Optional "Trusted Contact" → create row in `trust_circle_members` (alerts remain **inactive** until Phase 6)

### Acceptance Criteria
- Re-login does not create duplicate users
- Unauthenticated requests return `401`
- JWT persists across app restarts

---

## Phase 2 — AI Companion Chat
**Duration:** 5–7 days · **Complexity:** High

### Frontend
- Chat screen with streaming typewriter effect
- Conversation list screen
- **Basic tab navigation** (Home stub, Chat, Goals stub, Profile) — Goals tab shows empty state until Phase 4
- WebSocket connection management with reconnect logic

### Backend
- `WS /ws/chat/{user_id}` — token stream frames:
  - `{ "type": "token", "content": "..." }` per chunk
  - `{ "type": "end" }` on completion
- `GET /conversations` — list user conversations
- `GET /conversations/{id}/messages` — message history
- Redis working memory: last 10 messages per user (`chat_context:{user_id}`, 30-min TTL)

### Database
```sql
conversations (
  id UUID PK,
  user_id UUID FK → users,
  started_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  is_first_conversation BOOLEAN DEFAULT false
)

messages (
  id UUID PK,
  conversation_id UUID FK → conversations,
  role TEXT,              -- 'user' | 'assistant'
  content TEXT,
  mood_tag TEXT,          -- nullable; populated in Phase 3+
  created_at TIMESTAMPTZ
)
```

### AI — Two System Prompts
1. **Discovery Conversation Prompt** (first session only — `is_first_conversation = true`)
   - AI proactively asks 3–4 structured questions covering: personality/values, current life situation, emotional state, relationships/support system
   - Warm, curious tone; does not feel like a clinical intake form
2. **Regular Companion Prompt** (all subsequent sessions)
   - Empathetic, non-judgmental; references user profile context

**LangGraph:** Single-node state machine in Phase 2; expands in Phase 3+.  
**LLM Gateway:** `llm_gateway.py` wraps OpenAI calls (GPT-4o primary, GPT-4o-mini fallback).

### Acceptance Criteria
- Streaming tokens render progressively in chat UI
- Messages persisted to Postgres after each turn
- First conversation shows discovery questions; subsequent sessions use regular prompt
- Redis context correctly prefixes conversation history

---

## Phase 3 — Memory System
**Duration:** 6–8 days · **Complexity:** High

### Frontend
- "Remembering…" indicator during memory retrieval
- Profile screen — "Memory Summary" card ("N things I know about you")
- Empty state for new users with < 5 conversations

### Backend
**Memory Extraction Worker** (Celery task, fires async after every assistant response):
- Every 5 messages → call GPT-4o-mini with extraction prompt
- Structured output: `{ facts, emotions, people_mentioned, topics, summary }`
- Embed `summary` with `text-embedding-3-small` → upsert vector into Qdrant `episodic_memory`
- Update `user_profiles.ai_profile JSONB` with latest extracted facts

**Qdrant `episodic_memory` collection** (created on backend startup):
- Dimensions: 1536, Distance: Cosine, Index: HNSW
- Payload schema: `{ user_id, content, timestamp, emotion_tags, people_mentioned, topics, importance, conversation_id, surfaced_count }`
- Payload indexes: `user_id` (keyword), `timestamp` (range)

**Updated LangGraph Orchestrator** (adds RAG step before LLM call):
1. Embed incoming user message
2. Query Qdrant top-5, filtered by `user_id`
3. Inject retrieved memories as "What I remember about you:" block in system prompt

`GET /memory/summary` — returns `ai_profile` summary for Profile screen card.

### Acceptance Criteria
- Qdrant points visible after 5+ messages exchanged
- Phase 3+ chat naturally references facts from earlier conversations
- Memory extraction is truly async (does not block chat response)

---

## Phase 4 — Goals & Accountability
**Duration:** 4–5 days · **Complexity:** Medium

### Frontend
- Goals screen (list + progress bars)
- Create Goal screen (title, category, optional target date)
- Goal Detail screen + check-in history
- Check-in bottom sheet (progress slider 1–5 + optional note)
- "Goal" tag on messages where AI is acting as Goal Coach

### Backend
- Goals CRUD: `POST /goals`, `GET /goals`, `PATCH /goals/{id}`, `GET /goals/{id}`
- Check-in CRUD: `POST /goals/{id}/checkins`, `GET /goals/{id}/checkins`
- **Goal Coach LangGraph node:** reads user's active goals + last 3 check-ins → generates coaching response
- **Stale goal nudge:** Celery beat — if a goal has no check-in for > 3 days, queue a gentle in-app nudge

### Database
```sql
goals (
  id UUID PK,
  user_id UUID FK → users,
  title TEXT,
  description TEXT,
  category TEXT,
  target_date DATE,
  status TEXT DEFAULT 'active',   -- 'active' | 'completed' | 'abandoned'
  milestones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

goal_checkins (
  id UUID PK,
  goal_id UUID FK → goals,
  progress_score INT,             -- 1–5
  note TEXT,
  source TEXT DEFAULT 'user',    -- 'user' | 'ai_inferred'
  created_at TIMESTAMPTZ
)
```

### AI
- Goal Coach system prompt: encouraging, non-shaming tone
- `goal_related` intent routing in Orchestrator
- AI-inferred check-ins: extracted from conversation when user mentions goal progress (confidence threshold > 0.75)

### Acceptance Criteria
- Full goals CRUD works end-to-end
- AI-inferred check-ins appear in check-in history with `source = 'ai_inferred'`
- Stale goals (> 3 days) trigger nudge notification
- Goals screen renders progress correctly

---

## Phase 5 — Insights & Personalization
**Duration:** 4–5 days · **Complexity:** High

### Frontend
- **Home screen complete:**
  - Chat entry button (primary CTA)
  - "Today's Insight" card (dismissible)
  - 7-day mood emoji timeline
- Notifications screen (list, mark-read)
- FCM permission request on first launch (post-login)
- Device token registration flow

### Backend
**Insight Generator** (Celery beat, runs daily at 8 AM user local time):
1. Fetch last 7 days: Qdrant memories + `ai_profile` + `goal_checkins`
2. Call GPT-4o-mini with insight generation prompt → structured JSON: 3–5 insights
3. Write to `user_insights` (keep max 5 active; archive older ones)

**Mood Summary:** `GET /mood/summary` — aggregate `mood_tag` from `messages` over last 7 days.

**Endpoints:**
- `GET /insights/latest`
- `PATCH /insights/{id}/surface` — mark insight as surfaced/dismissed
- `POST /notifications/register-device` — store FCM token on user record

**Daily check-in push:** Celery beat → FCM at user's `preferred_checkin_time`.

### Database
```sql
user_insights (
  id UUID PK,
  user_id UUID FK → users,
  category TEXT,
  content TEXT,
  confidence FLOAT,
  surfaced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
)

notifications (
  id UUID PK,
  user_id UUID FK → users,
  type TEXT,
  title TEXT,
  body TEXT,
  channel TEXT,     -- 'push' | 'sms' | 'email'
  status TEXT,      -- 'sent' | 'delivered' | 'failed'
  created_at TIMESTAMPTZ
)
```

**Schema additions:**
```sql
ALTER TABLE users ADD COLUMN fcm_token TEXT;
ALTER TABLE users ADD COLUMN preferred_checkin_time TIME;
```

### AI
- Insight generation prompt: structured output, no-repeat constraint (checks against last 5 surfaced insights)
- `mood_tag` extraction added to Memory Extraction worker
- Companion Agent: inject 1–2 unsurfaced insights into context when thematically relevant

### Infrastructure
- Firebase project created; FCM service account credentials in env: `FIREBASE_SERVICE_ACCOUNT_JSON`

### Acceptance Criteria
- 3–5 insights generated after 7+ days of data
- FCM push received on a physical device
- Insight dismiss (surface) updates `surfaced = true`
- Empty state renders cleanly for new users

---

## Phase 6 — Risk Detection & Trust Circle
**Duration:** 5–6 days · **Complexity:** High

### Frontend
- Trust Circle screen (contact list + "Add Contact" button)
- Add Contact bottom sheet (name, phone, alert level: concern / urgent / emergency)
- Settings screen (quiet hours toggle + risk monitoring toggle)
- In-app alert banner when risk level elevates

### Backend
**Trust Circle CRUD:** `GET /trust-circle`, `POST /trust-circle`, `DELETE /trust-circle/{id}`

**Risk Monitor Worker** (Celery beat, every 4 hours):
1. Fetch last 7 days: `messages.mood_tag` + top Qdrant memories
2. Compute rule-based scores (see AI section below)
3. Write `risk_scores` row
4. If `overall_level >= high` AND cooldown elapsed → queue Intervention Worker on `critical` queue

**Crisis Keyword Detection** (real-time, in Orchestrator):
- Scans user message before LLM call
- If keyword matched → skip normal flow → immediately queue Intervention Worker

**Intervention Worker** (`critical` Celery queue):
- Compose SMS: `"Hi [contact_name], [user_display_name] may need your support right now. Please reach out when you can."`
- Send via Twilio
- Write `notifications` row (`type = 'trust_circle'`)
- Enforce 24-hour per-contact cooldown (Redis key: `intervention_cooldown:{user_id}:{contact_id}`)

### Database
```sql
trust_circle_members (
  id UUID PK,
  user_id UUID FK → users,
  name TEXT,
  phone TEXT,
  email TEXT,
  alert_level TEXT,   -- 'concern' | 'urgent' | 'emergency'
  created_at TIMESTAMPTZ
)

risk_scores (
  id UUID PK,
  user_id UUID FK → users,
  isolation_score INT,
  burnout_score INT,
  distress_score INT,
  crisis_probability FLOAT,
  overall_level TEXT,    -- 'low' | 'medium' | 'high' | 'critical'
  scored_at TIMESTAMPTZ
)
```

**Schema addition:**
```sql
ALTER TABLE user_profiles ADD COLUMN risk_monitoring_enabled BOOLEAN DEFAULT true;
```

### AI — Risk Scoring Rules
| Signal | Score |
|--------|-------|
| No social mentions + low engagement (< 1 chat/day for 5 days) | isolation++ |
| Stress keywords + negative mood trend ≥ 3 days | burnout++ |
| `mood_tag` negative > 70% of last 20 messages | distress++ |
| Crisis keyword detected in message | crisis = immediate |
| No negative signals in 48h | decay all scores by 20% |

> **Crisis keyword list:** test 20+ edge cases including indirect phrasing before shipping. Conservative is better — false negatives are worse than false positives here.

### Infrastructure
- Twilio credentials in env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Celery priority queues configured: `default` + `critical`

### Acceptance Criteria
- SMS arrives on test phone when threshold exceeded
- 24-hour cooldown respected (second alert suppressed)
- Crisis keyword bypasses the 4-hour cycle and triggers immediately
- Risk monitoring toggle in Settings disables scoring for that user

---

## Phase 7 — MVP Hardening & Release
**Duration:** 4–5 days · **Complexity:** Medium

### Frontend
- Error boundaries on all screens
- Offline banner (no network → graceful degradation, no crash)
- Consistent loading skeleton states
- Settings: sign out + delete account
- App icon + splash screen (final assets)
- EAS build → TestFlight (iOS) + Google Play Internal Testing (Android)

### Backend
- **Input validation audit:** Pydantic validators on every endpoint; reject unexpected fields
- **Rate limiting** (slowapi): 60 req/min per user; 1 active WS connection per user
- **Sanitized error responses:** no stack traces in production; return `{ "error": { "code": "...", "message": "..." } }`
- **Account deletion:** `DELETE /account` — hard delete cascade across Postgres, Qdrant (delete by `user_id` filter), Redis (flush all user keys)
- `GET /health/detailed` — reports Postgres, Redis, Qdrant connectivity
- Debug mode disabled in production config

### Database
- Add indexes on all `user_id` FK columns
- Verify `ON DELETE CASCADE` on all child tables
- Run `VACUUM ANALYZE` before first production deployment

### AI
- Final system prompt review: tone calibration, crisis language audit
- Graceful fallback message when LLM is unavailable: `"I'm having trouble connecting right now. I'm here for you — please try again in a moment."`
- Token budget audit per request type (ensure no overrun on large memory context)

### Infrastructure
| Service | Provider |
|---------|----------|
| Backend | Railway or Fly.io |
| Postgres | Supabase or Railway Postgres |
| Redis | Upstash Redis |
| Qdrant | Qdrant Cloud Free or self-hosted VPS |
| Error tracking | Sentry (free tier) |

### Acceptance Criteria
- TestFlight build passes App Store review checks
- All `401`/`403` boundary checks pass (automated test run)
- `DELETE /account` removes all data from Postgres, Qdrant, and Redis
- Sentry capturing events from production

---

## Timeline Summary

| Phase | Focus | Duration |
|-------|-------|----------|
| 0 | Development Foundation | 2–3 days |
| 1 | Auth + User Profile | 4–5 days |
| 2 | AI Companion Chat | 5–7 days |
| 3 | Memory System | 6–8 days |
| 4 | Goals & Accountability | 4–5 days |
| 5 | Insights & Personalization | 4–5 days |
| 6 | Risk Detection & Trust Circle | 5–6 days |
| 7 | MVP Hardening & Release | 4–5 days |
| **Total** | | **34–44 days (~7–9 weeks)** |

---

## Minimum Demo-Ready Build

**Phases 0–3 only (~3 weeks)**

Persistent identity + meaningful AI conversation + memory recall across sessions = enough to validate the core hypothesis and demonstrate the magic moment.

Ship phases 4–7 after validating that users feel understood.

---

## Time-Constraint Simplifications

If running tight on time, these cuts reduce scope without breaking the core loop:

| Feature | Simplification |
|---------|---------------|
| Trust Circle | Hardcode yourself as the only contact — remove CRUD entirely |
| Mood chart | Replace 7-day timeline with a single emoji |
| Notifications screen | Skip filter tabs — flat list only |
| Settings | One toggle only: quiet hours |
