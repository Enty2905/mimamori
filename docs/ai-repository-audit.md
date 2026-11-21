# Mimamori AI — Companion AI Repository Audit

> **Phase A Audit** | Scope: Read-only inspection of `e:\mimamori` and local Windows development tooling.
> All file paths, symbols, configurations, and runtime checks below were directly observed in the repository and host environment.

---

## 1. Repository Overview & Top-Level Structure

`e:\mimamori` is a multi-module monorepo for an elderly care and companionship platform (`Mimamori AI`):

| Directory / File | Purpose | Observed Stack / State |
| :--- | :--- | :--- |
| `backend/` | Core REST API, auth, care scheduling, Groq LLM & Whisper proxy | Java `21`, Spring Boot `4.1.0`, Maven (`backend/pom.xml`), MySQL, Flyway, Redis, Quartz |
| `app/` | Cross-platform mobile app (`ELDERLY` & `CAREGIVER` roles) | Expo SDK `58` (`^58.0.0`), React Native `0.88.1`, React `19.3.0`, TypeScript `~6.0.3` (`app/package.json`) |
| `ai/` | Existing internal Python RAG service stub | Python `>=3.13,<3.14` (`.python-version`: `3.13`), `uv`, FastAPI (`ai/src/api/main.py` bootstrap only) |
| `docker/` | Local container infrastructure (`docker-compose.yml`, `.env`, `README.md`) | MySQL `8.4.10`, Redis `8.8.1-alpine`, Qdrant `v1.18.3`, `ai` (`:8000`), `backend` (`:8080`) |
| `docs/` | Project documentation & architecture reports | Contains `backend-report.md`, `frontend-report.md`, and `.gitkeep` stubs (`adr/`, `ai-evaluation/`, `api/`, `architecture/`, `ux/`) |
| `.github/` | GitHub Actions CI (`workflows/ci.yml`) | 3 jobs: `backend` (`./mvnw -B test`), `ai` (`uv sync` + `ruff` + `pytest`), `mobile` (`npm ci` + `lint` + `typecheck` + `test`) |
| Root files | `.env`, `.env.example`, `README.md`, `.editorconfig`, `.gitignore`, `.gitattributes` | Note: root `README.md` still contains stale bootstrap boilerplate (`Spring Boot 4.1`, `Expo SDK 57`), whereas `backend/`, `app/`, and `docker/` are actively implemented |

---

## 2. Current Architecture

```text
+--------------------------+        HTTPS / REST + JWT        +-----------------------------------+
|  Mobile App (app/)       |  ----------------------------->  |  Spring Boot Backend (backend/)   |
|  Expo 58 / React Native  |                                  |  Java 21 / Port 8080              |
|  - ElderlyCompanionScreen|  POST /api/conversations/{id}/   |  - SecurityConfig + JwtAuthFilter |
|  - useVoiceRecognition   |       messages                   |  - ConversationController/Service |
|  - voiceSpeechService    |  POST /api/speech/transcribe     |  - SpeechController/Service       |
+--------------------------+                                  |  - CareAgentService (@Scheduled)  |
         |                                                    +---+---------------+---------------+
         | On-device STT (ExpoSpeechRecognition)                  |               |
         | & TTS (expo-speech, vi-VN)                             v               v
                                                      +------------------+  +-------------------------+
                                                      | Groq Cloud API   |  | Data & Infra (docker/)  |
                                                      | - gpt-oss-120b   |  | - MySQL 8.4 (port 3307) |
                                                      | - gpt-oss-20b    |  | - Redis 8.8 (port 6379) |
                                                      | - whisper-large  |  | - Qdrant (port 6333)    |
                                                      |   -v3-turbo / v3 |  | - mimamori-ai-1 (:8000) |
                                                      +------------------+  +-------------------------+
```

### 2.1 Mobile (`app/`)
- Configured in `app/app.config.ts` (`com.mimamori.app`, `platforms: ['android', 'ios']`) with `expo-router`, `expo-dev-client`, `expo-speech-recognition`, `expo-audio`, `expo-speech`, `expo-secure-store`, and Firebase (`app`, `messaging`, `crashlytics`).
- `app/src/core/api/client.ts` targets `process.env.EXPO_PUBLIC_API_URL || 'http://192.168.101.21:8080'`, with a `25000ms` default request timeout, `XMLHttpRequest` multipart upload support for `FormData`, and automatic `Authorization: Bearer <token>` injection.
- Auth state (`app/src/core/auth/useAuthStore.ts`) stores the JWT in `expo-secure-store` (or `localStorage` on web) under key `mimamori_jwt_token`.

### 2.2 Spring Boot Backend (`backend/`)
- `backend/pom.xml`: `spring-boot-starter-parent` `4.1.0`, Java `21`, `spring-ai-bom` `2.0.0` (`spring-ai-starter-model-openai`), `springdoc-openapi-starter-webmvc-ui` `3.0.3`, `spring-boot-starter-data-jpa`, `spring-boot-starter-data-redis`, `spring-boot-starter-flyway` + `flyway-mysql`, `spring-boot-starter-quartz`, `spring-boot-starter-security` + `oauth2-resource-server`, `spring-boot-starter-actuator`, `mysql-connector-j`.
- `backend/src/main/resources/application.yml`:
  - Runs on `server.port` (`SERVER_PORT`, default `8080`) with UTF-8 forced encoding and `10MB` multipart upload limit.
  - Connects to MySQL (`jdbc:mysql://localhost:3307/mimamori`, `jpa.hibernate.ddl-auto: validate`, Flyway `baseline-on-migrate: true`) and Redis (`localhost:6379`).
  - Sets `mimamori.ai-service.url` (`AI_SERVICE_URL`, default `http://localhost:8000`).
  - Configures Groq LLM and Whisper keys/models (`mimamori.groq.*`). Note: while `spring-ai-starter-model-openai` is in `pom.xml` and `spring.ai.openai.*` exists in `application.yml`, actual chat and speech requests are executed directly via Spring `RestClient` inside `GroqService` and `SpeechService`.

### 2.3 Existing Infrastructure & `ai/` Service
- `docker/docker-compose.yml` defines 5 services: `mysql` (`mysql:8.4.10`, host `3307->3306`), `redis` (`redis:8.8.1-alpine`, `6379->6379`), `qdrant` (`qdrant/qdrant:v1.18.3`, `6333-6334`), `ai` (`../ai`, `8000->8000`, `QDRANT_URL=http://qdrant:6333`), and `backend` (`../backend`, `8080->8080`, `AI_SERVICE_URL=http://ai:8000`).
- Live `docker ps -a` output during audit confirms `mimamori-ai-1` (`0.0.0.0:8000->8000/tcp`), `mimamori-mysql-1` (`3307`), `mimamori-redis-1` (`6379`), and `mimamori-qdrant-1` (`6333-6334`) are **currently running**, while `mimamori-backend-1` is `Exited (143)`.
- `e:\mimamori\ai\` is a **bootstrap skeleton only**:
  - `ai/pyproject.toml`: `requires-python = ">=3.13,<3.14"`, dependencies `fastapi`, `httpx`, `pydantic`, `pydantic-settings`, `qdrant-client`, `sentence-transformers`, `uvicorn[standard]`.
  - `ai/Dockerfile`: `ghcr.io/astral-sh/uv:0.12.3` + `python:3.13-slim`, `uv sync --frozen --no-dev --no-install-project`, serving `src.api.main:app` on port `8000`.
  - `ai/src/api/main.py`: 3 lines (`app = FastAPI(title="Mimamori AI Service", docs_url=None, redoc_url=None)`) with **zero routes implemented**.
  - `ai/src/{chunking,common,embeddings,evaluation,ingestion,rag,retrieval}/` contain only `.gitkeep`; `ai/datasets/README.md` and `ai/training/README.md` are policy/placeholder docs; `ai/tests/test_bootstrap.py` only asserts `app.title`.

#### How `e:\mimamori\ai\` Differs from New `ai-service/` and `ai-training/`
| Aspect | Existing `ai/` | New `ai-service/` | New `ai-training/` |
| :--- | :--- | :--- | :--- |
| **Role** | Original Qdrant RAG service stub wired to `docker-compose.yml` & CI | Independent Vietnamese Elderly Companion AI runtime (RAG + LLM + safety guardrails) | Offline / Google Colab T4 QLoRA fine-tuning, dataset generation & eval |
| **Status** | Bootstrap only (no routes/logic); **must not be modified** | New greenfield microservice | New greenfield ML training workspace |
| **Python / Tooling** | Python `3.13` + `uv` (`uv.lock`) | Python `3.12` (host `py -3.12`) + `venv`/`pip` (since `uv` is not installed locally) | Colab T4 GPU (for QLoRA) + local Python `3.12` for data prep/scripts |
| **Vector Store / Deps** | `qdrant-client`, `sentence-transformers` | Compact multilingual embeddings + ChromaDB / lightweight retrieval | `transformers`, `peft`, `trl`, `bitsandbytes`, `accelerate`, `datasets` |
| **Network Port** | Bound to host/container port **`8000`** (`mimamori-ai-1`) | Separate dev port (recommended **`8001`**) | N/A (offline / notebook execution) |

---

## 3. Existing Conversation Flow (API, Auth, Entities, `conversationId` Retention)

### 3.1 Authentication & Authorization
- `SecurityConfig.java`: disables CSRF, enables permissive CORS (`allowedOriginPatterns: *`, `allowCredentials: true`), enforces `SessionCreationPolicy.STATELESS`, permits `/api/auth/**`, `/actuator/**`, `/v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html`, and requires authentication for all `/api/**` routes.
- `JwtService.java`: signs and verifies `HS256` JWTs (`expirationMs = 86400000` / 24h) containing claims `sub` (`username`), `userId` (`Long`), `role` (`ELDERLY` or `CAREGIVER`), `iat`, and `exp`.
- `JwtAuthFilter.java`: parses `Authorization: Bearer <token>`, sets `UsernamePasswordAuthenticationToken` principal to `userId` (`Long`) and authority `ROLE_<role>`, injected into controllers via `@AuthenticationPrincipal Long userId`.

### 3.2 End-to-End Conversation Lifecycle
1. **Session Init (`GET /api/conversations/active`)**:
   - `ElderlyCompanionScreen.tsx` (`initConversation`) calls `GET /api/conversations/active` on mount (and lazily in `sendMessage` if `conversationRef.current` is null).
   - `ConversationController.getActiveConversation` delegates to `ConversationService.getOrCreateActiveConversation(elderlyId)`.
   - `ConversationRepository.findFirstByElderlyIdOrderByLastMessageAtDesc(elderlyId)` fetches the elderly user's latest `Conversation` or creates one (`title = "Trò chuyện cùng Mimamori AI"`) seeded with an initial `MessageSender.AI` welcome message.
   - Returns `ConversationDto` (`id`, `elderlyId`, `title`, `lastMessageAt`, `messages`, `createdAt`).
2. **History Load & `conversationId` Retention (`GET /api/conversations/{id}/messages`)**:
   - Mobile retains `conversation` and `conversationRef.current` (`id`) in component state/ref and fetches existing messages via `GET /api/conversations/{id}/messages`.
   - Because MySQL persists `conversations` per `elderly_id` and `/active` always returns the most recent conversation (`OrderByLastMessageAtDesc`), the same `conversationId` is preserved across app restarts and re-logins.
   - `ConversationService.getMessages(currentUserId, conversationId)` permits either the owner (`elderly_id == currentUserId`) or a linked `CAREGIVER` whose `FamilyRelationship.canViewConversations` is `true`; otherwise throws `403`.
3. **Send Message & Reply (`POST /api/conversations/{id}/messages`)**:
   - Mobile sends `{ content: text, message: text }`.
   - `ChatMessageRequest` binds `content` (`@JsonAlias({"message", "text"})`) with fallback to `message`; `ConversationController.sendMessage` rejects blank text with HTTP `400`.
   - `ConversationService.sendMessage`:
     1. Verifies ownership (`conv.getElderly().getId().equals(elderlyId)`, else `403`).
     2. Persists user `ChatMessage` (`sender = MessageSender.USER`).
     3. Calls `fetchAiCompanionReply(conv, request.getContent())`.
     4. Persists AI `ChatMessage` (`sender = MessageSender.AI`; `tokensUsed` remains default `0`).
     5. Updates `conv.setLastMessageAt(Instant.now())` and returns `ChatMessageDto`.
   - **Minor contract note**: `ElderlyCompanionScreen.tsx` types `Message.sender` as `'USER' | 'ASSISTANT' | 'SYSTEM'`, whereas backend `MessageSender` emits `'USER' | 'AI' | 'SYSTEM'`. Rendering works because UI checks `item.sender === 'USER'` (`!isUser`), though mobile offline fallback inserts `'ASSISTANT'`.

---

## 4. Existing AI, Care Safety, and Voice Integration

### 4.1 LLM Chat & Fallback Chain (`GroqService` & `ConversationService`)
- **Primary & Secondary Cloud LLM (`GroqService.generateCompanionReply`)**:
  - Builds a Vietnamese elderly companion `systemPrompt` (`cháu` / `cụ`–`bác`–`ông/bà`, 2–4 concise warm sentences, prioritized emergency 115 guidance for chest pain / dyspnea / fainting / severe dizziness / falls, and strict prohibition against diagnosing or prescribing medication).
  - Appends up to the **last 6** messages from `history` (`USER` -> `"user"`, non-`USER` -> `"assistant"`), then appends `userMessage`. *(Observation: `ConversationService.sendMessage` saves `userMsg` before querying `messageRepository.findByConversationIdOrderByCreatedAtAsc`, so `history` already includes the current turn and `GroqService` appends `userMessage` a second time.)*
  - Calls Groq `/chat/completions` (`temperature: 0.7`, `max_tokens: 250`, 5s connect / 20s read timeout):
    1. Primary model: `openai/gpt-oss-120b`
    2. Fallback model: `openai/gpt-oss-20b`
    3. Rule-based fallback: `GroqService.getHeuristicFallback(userMessage)` (covers emergency 115 keywords, jokes, fatigue/pain/fever, medications, weather, greetings, and a generic prompt).
- **Unreachable `AI_SERVICE_URL` Branch in `ConversationService`**:
  - `ConversationService.fetchAiCompanionReply` attempts `groqService.generateCompanionReply(...)` first, then has a secondary block calling `restClient.post().uri("/api/companion/chat")` on `mimamori.ai-service.url` (`http://localhost:8000`) with `{"elderly_id", "message"}`, and finally a third heuristic block.
  - Because `GroqService.callGroq` catches all exceptions and `generateCompanionReply` always falls back to `getHeuristicFallback`, `groqService.generateCompanionReply` always returns a non-blank string—making the `/api/companion/chat` call in `ConversationService` unreachable under normal execution (and `ai/src/api/main.py` does not implement `/api/companion/chat` anyway).
- **Mobile Offline Fallback (`ElderlyCompanionScreen.tsx`)**:
  - On network/backend failure, mobile checks `EMERGENCY_KEYWORDS` (`isEmergencyText`) and displays an offline `⚠️ CẢNH BÁO KHẨN CẤP` bubble with a `Gọi cấp cứu 115` (`tel:115`) button, or scripted topic responses.

### 4.2 Daily Check-In & Care Agent Safety (`CheckInService`, `CareAgentService`, `DashboardService`)
- `CheckInService.submitCheckIn`: flags `concerningFlag = true` on `POOR`/`TIRED` mood, `PAIN`/`DIZZY` physicalHealth, `INSOMNIA` sleepQuality, or `POOR` appetite, and invokes `GroqService.analyzeCheckIn(...)` (`openai/gpt-oss-20b`, `max_tokens: 150`) to generate a 1–2 sentence Vietnamese `aiAnalysisSummary`.
- `CareAgentService`: runs `@Scheduled(fixedRate = 900000)` (every 15 minutes) across all `UserRole.ELDERLY` users and is also invoked synchronously by `DashboardService.getOverview`:
  - Marks `PENDING` `MedicationLog` items > 1 hour overdue as `MISSED`, creating `CareAlert` (`MISSED_MEDICATION`, `HIGH`) and notifying linked caregivers via `AlertService` -> `NotificationService`. *(Note: `MedicationService.getTodaySchedule` also auto-marks `PENDING` logs > 2 hours overdue as `MISSED`.)*
  - Generates `MISSED_CHECKIN` (`MEDIUM`) after 18:00 if no `DailyCheckIn` exists, and `CHECKIN_CONCERN` (`HIGH`) when `concerningFlag` is `true`.
  - Computes `careStatus` (`NORMAL`, `REMINDER_REQUIRED`, `NEEDS_ATTENTION`) and upserts `DailySummary`.
- **Personal Context Gap**: Currently, `ConversationService` / `GroqService` only pass `elderly.getFullName()` and chat history to the LLM. Active `Medication` schedules, `MedicationLog` adherence, `DailyCheckIn`, `HealthCondition` records, and `CareAlert` status are **not** included in companion chat prompts.

### 4.3 Voice & Speech Integration (STT + TTS)
- **Speech-to-Text (STT)**:
  - Mobile (`app/src/core/voice/useVoiceRecognition.ts`): uses dual-engine detection (`SttEngine = 'native' | 'cloud-fallback' | 'unavailable'`).
    1. **Primary (`native`)**: `expo-speech-recognition` (`lang: 'vi-VN'`, `interimResults: true`, `maxDurationMs: 60_000`, `addsPunctuation: true`). Automatically switches to `'cloud-fallback'` on `service-not-allowed` or `language-not-supported` if `expo-audio` is present.
    2. **Fallback (`cloud-fallback`)**: records audio via `expo-audio` (`RecordingPresets.HIGH_QUALITY`, metering enabled) and uploads multipart `FormData` to `POST /api/speech/transcribe?language=vi` (`timeoutMs: 25000`).
  - Backend (`SpeechController` + `SpeechService`): enforces `<= 10MB` size, validates extension (`m4a, mp4, aac, wav, mp3, webm, ogg, 3gp`) and MIME type, reads audio strictly **in-memory** (`ByteArrayResource`, zero disk/DB storage), and POSTs to Groq `/audio/transcriptions` with fallback chain `whisper-large-v3-turbo` -> `whisper-large-v3` (20s read timeout, localized Vietnamese error messages for 400/413/422/429/502/503/504).
- **Text-to-Speech (TTS)**:
  - Mobile (`app/src/core/voice/voiceSpeechService.ts` + `ElderlyCompanionScreen.tsx`): uses on-device `expo-speech` (`vi-VN`, default `speechRate: 0.9`, range `[0.5, 1.5]`), strips markdown (`sanitizeTextForSpeech`), splits text into sentence chunks (`ANDROID_SAFE_CHUNK_LIMIT = 3500`, with chunk-index pause/resume workaround on Android), ranks Vietnamese voices (`vi-VN`, `Enhanced`), and supports `autoTts` plus hands-free `continuousMode` (350ms inter-turn delay; stops cleanly on STT or TTS errors).

---

## 5. Existing Database Entities & Migrations

Defined across `V1__init_schema.sql` (tables 1–11) and `V2__health_conditions.sql` (table 12), validated by Hibernate (`ddl-auto: validate`):

| # | Table (`sql`) | JPA Entity (`com.mimamori.*`) | Key Columns / Enums / Constraints |
| :---: | :--- | :--- | :--- |
| 1 | `users` | `userprofile.entity.User` | `id`, `username` (UNIQUE), `email` (UNIQUE), `password_hash`, `full_name`, `role` (`UserRole`: `ELDERLY`, `CAREGIVER`), `phone`, `emergency_contact`, `avatar_url`, `language_preference` (`'vi'`) |
| 2 | `family_relationships` | `userprofile.entity.FamilyRelationship` | `caregiver_id`, `elderly_id` (`uq_family_pair`), `relationship_type`, `status` (`RelationshipStatus`: `PENDING`, `ACCEPTED`, `REJECTED`), `can_view_conversations` |
| 3 | `medications` | `medication.entity.Medication` | `elderly_id`, `name`, `dosage`, `instructions`, `start_date`, `end_date`, `is_active` |
| 4 | `medication_schedules` | `medication.entity.MedicationSchedule` | `medication_id`, `reminder_time` (`LocalTime`), `dosage_amount`, `days_of_week` (`'DAILY'`) |
| 5 | `medication_logs` | `medication.entity.MedicationLog` | `schedule_id`, `medication_id`, `elderly_id`, `scheduled_time`, `taken_time`, `status` (`MedicationStatus`: `PENDING`, `TAKEN`, `MISSED`, `SKIPPED`), `notes` |
| 6 | `daily_checkins` | `conversation.entity.DailyCheckIn` | `elderly_id`, `checkin_date` (`uq_elderly_date`), `mood`, `physical_health`, `sleep_quality`, `appetite`, `notes`, `concerning_flag`, `ai_analysis_summary` |
| 7 | `conversations` | `conversation.entity.Conversation` | `elderly_id`, `title`, `last_message_at`, `created_at` |
| 8 | `chat_messages` | `conversation.entity.ChatMessage` | `conversation_id`, `sender` (`MessageSender`: `USER`, `AI`, `SYSTEM`), `content` (`TEXT`), `tokens_used`, `created_at` |
| 9 | `care_alerts` | `notification.entity.CareAlert` | `elderly_id`, `caregiver_id`, `alert_type` (`AlertType`), `severity` (`AlertSeverity`), `description`, `is_read`, `is_resolved`, `resolved_at` |
| 10 | `daily_summaries` | `agent.entity.DailySummary` | `elderly_id`, `summary_date` (`uq_summary_elderly_date`), `medication_adherence_rate`, `checkin_summary`, `alert_count`, `ai_health_note` |
| 11 | `notifications` | `notification.entity.Notification` | `user_id`, `title`, `body`, `type`, `reference_id`, `is_read` |
| 12 | `health_conditions` | `health.entity.HealthCondition` | `elderly_id`, `created_by_id`, `condition_name`, `status` (`STABLE`/`MONITORING`/`WORSENING`/`RECOVERED`), `severity` (`MILD`/`MODERATE`/`SEVERE`), `record_date`, `next_checkup_date`, `doctor_or_clinic`, `symptoms_or_notes` |

---

## 6. Potential Integration Conflicts & Risks

1. **Port `8000` Collision (`mimamori-ai-1`)**:
   - `docker/docker-compose.yml` exposes `ai` on `8000:8000`, and `mimamori-ai-1` is currently running and bound to `0.0.0.0:8000->8000/tcp`.
   - `application.yml` also defaults `mimamori.ai-service.url` to `http://localhost:8000`.
   - **Mitigation**: Bind the new `ai-service/` dev server to a separate port such as **`8001`** (`http://localhost:8001`). Do not stop or repurpose `mimamori-ai-1`.
2. **Isolation of Existing `backend/`, `app/`, `ai/`, `docker/` & CI**:
   - `.github/workflows/ci.yml` executes `./mvnw -B test` (`backend/`), `uv sync` + `pytest` (`ai/`), and `npm run lint/typecheck/test` (`app/`).
   - **Mitigation**: Keep `ai-service/` and `ai-training/` as top-level independent directories so existing builds, Docker services, and CI jobs remain undisturbed.
3. **PII, Health Privacy, Secret Hygiene & JWT Boundaries**:
   - Database tables (`users`, `health_conditions`, `medications`, `daily_checkins`, `chat_messages`) store sensitive health and identity data (`full_name`, `phone`, `emergency_contact`, `doctor_or_clinic`, `symptoms_or_notes`).
   - `ai/datasets/README.md` and `ai/training/README.md` explicitly forbid PII or raw health conversations in versioned datasets. `ai-training/` must train/evaluate strictly on synthetic or de-identified Vietnamese data.
   - `ai-service/` should not connect directly to MySQL or store user credentials/JWT secrets. Authentication (`JwtAuthFilter`) and caregiver authorization (`FamilyRelationship`) belong in Spring Boot, which should pass only minimal, non-identifying context when delegating to `ai-service/`.
   - **Existing Secret Hygiene Finding**: `backend/src/main/resources/application.yml` (and `GroqService.java` constructor default) embed fallback default values for `mimamori.jwt.secret` and `mimamori.groq.api-key`. New `ai-service/` and `ai-training/` modules must load all API keys/tokens strictly from environment variables with no hardcoded fallbacks.
4. **Qwen3.5 vs `transformers` Compatibility Conflict**:
   - `Qwen/Qwen3-4B-Instruct-2507` uses `model_type: "qwen3"` (`Qwen3ForCausalLM` / `AutoModelForCausalLM`, `AutoTokenizer`), runs in **non-thinking mode** out of the box, supports 256K context, and works reliably with standard `transformers` + `peft` + `trl` + `bitsandbytes` pipelines.
   - By contrast, `Qwen/Qwen3.5-4B` uses an early-fusion multimodal + hybrid linear-attention / Gated Delta Networks architecture (`qwen3_5` / `Qwen3_5ForConditionalGeneration` with `AutoProcessor`), requiring cutting-edge `transformers` (latest stable or `main` branch) and multimodal `AutoProcessor` message schemas (`content: [{"type": "text", ...}]`). Standard `AutoModelForCausalLM` / older `transformers` versions fail on `Qwen/Qwen3.5-4B`.
5. **Local Python & Tooling Constraint (`uv` / Python `3.13` Absent Locally)**:
   - Existing `ai/` requires Python `3.13` and `uv`, neither of which is installed on this Windows machine. Local development for `ai-service/` and `ai-training/` must target **Python `3.12`** (available via `py -3.12`) with standard `venv` + `pip`.

---

## 7. Recommended AI Architecture (`ai-training/` + `ai-service/`)

```text
e:\mimamori\
├── ai-training/                    # Offline / Colab T4 fine-tuning & evaluation (no runtime coupling)
│   ├── data/                       # Synthetic & curated de-identified Vietnamese elderly care dialogues
│   ├── notebooks/ & scripts/       # QLoRA fine-tuning (Qwen/Qwen3-4B-Instruct-2507) + eval harness
│   └── outputs/                    # Local gitignored adapter checkpoints / GGUF exports
└── ai-service/                     # Independent FastAPI service (dev port 8001)
    ├── knowledge/                  # Curated non-PII Vietnamese elderly care, nutrition, safety docs
    ├── vector_store/               # Local ChromaDB persistence (compact multilingual CPU embeddings)
    ├── app/                        # FastAPI endpoints (/health, /api/companion/chat), RAG, guardrails
    └── tests/                      # Unit & safety-eval tests (emergency 115, anti-diagnosis, tone)
```

- **Decoupled Responsibilities**:
  - **`ai-training/`** produces an empathetic, safety-aligned Vietnamese elderly companion LoRA adapter (e.g., `Qwen/Qwen3-4B-Instruct-2507` QLoRA on Colab Free T4 15GB) and runs offline safety/quality evaluation without polluting runtime dependencies.
  - **`ai-service/`** runs independently on port `8001` with CPU-friendly local RAG (ChromaDB + compact multilingual embeddings fitting a 16GB Windows laptop without GPU) and layered safety guardrails (emergency `115` escalation, strict no-diagnosis / no-prescription filter, concise 2–4 sentence Vietnamese formatting suitable for `expo-speech` TTS).
  - **Spring Boot as Personal Context Orchestrator (Future Integration)**: When explicitly integrated later, Spring Boot retains JWT validation, MySQL persistence (`conversations`, `chat_messages`), `CareAlert` escalation, and ownership checks. Before calling `ai-service` (`http://localhost:8001/api/companion/chat`), Spring Boot should construct a **sanitized summary** of personal context (preferred honorific/first name, active medication adherence summary, today's check-in mood/flags, active `HealthCondition` notes without PII identifiers, and recent 6 turns)—never exposing raw database credentials, emails, phones, or cross-user embeddings to `ai-service`.

---

## 8. Files That Must NOT Be Modified

Do **not** edit, delete, or overwrite any existing repository files during Companion AI development:
- `e:\mimamori\backend\**` (Java controllers, services, entities, Flyway SQL, `pom.xml`, `application.yml`, tests)
- `e:\mimamori\app\**` (React Native screens, voice hooks/services, `package.json`, `app.config.ts`)
- `e:\mimamori\ai\**` (existing Qdrant RAG stub, `pyproject.toml`, `uv.lock`, `Dockerfile`, `src/api/main.py`)
- `e:\mimamori\docker\**` (`docker-compose.yml`, `.env`, `README.md`)
- `e:\mimamori\.github\**` (`workflows/ci.yml`)
- `e:\mimamori\.env`, `e:\mimamori\.env.example`, `e:\mimamori\app\.env`
- `e:\mimamori\README.md`, `e:\mimamori\docs\backend-report.md`, `e:\mimamori\docs\frontend-report.md`

---

## 9. Local Python, Tooling & Disk Status (Observed on Windows)

Verified directly on host (`BypassSandbox: true`):

| Tool / Resource | Status | Exact Observed Path / Output |
| :--- | :--- | :--- |
| `python` (PATH) | **Not found** | `where.exe python` failed; `python` not recognized in default PowerShell PATH |
| `py` Launcher | **Installed** | `C:\Windows\py.exe` |
| Python `3.12` (via `py -3.12`) | **Installed** | `C:\Users\Dell\anaconda3\python.exe` -> `Python 3.12.7`, `pip 25.3` |
| Python `3.10` (via `py -3.10`) | **Installed** | `C:\Users\Dell\AppData\Local\Programs\Python\Python310\python.exe` -> `Python 3.10.8`, `pip 22.2.2` |
| Python `3.8` (via `py -3.8`) | **Installed** | `C:\Users\Dell\AppData\Local\Programs\Python\Python38\python.exe` |
| `pip` (PATH) | **Not found** | Not on PATH; invoked as `py -3.12 -m pip` (`25.3`) or `py -3.10 -m pip` (`22.2.2`) |
| `uv` | **Not found** | Not on PATH, nor at `C:\Users\Dell\.local\bin\uv.exe` or `C:\Users\Dell\.cargo\bin\uv.exe` |
| `conda` | **Installed (off-PATH)** | `where.exe conda` failed; binary present at `C:\Users\Dell\anaconda3\Scripts\conda.exe` -> `conda 24.11.3` |
| `node` | **Installed** | `C:\Program Files\nodejs\node.exe` -> `v24.15.0` |
| `java` | **Installed** | `jdk-17` & `jdk-22` present; active `java -version` = `java version "22.0.1" 2024-04-16` |
| `docker` | **Installed & Running** | `C:\Users\Dell\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe` -> `Docker version 29.6.2, build dfc4efb` |
| **Drive `C:` Space** | Available | **95.96 GB free** (`103,039,897,600` bytes free; `346.64 GB` used) |
| **Drive `E:` Space** | Available | **436.64 GB free** (`468,838,150,144` bytes free; `51.64 GB` used) |
