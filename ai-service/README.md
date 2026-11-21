# Mimamori Companion AI Service (`ai-service/`)

Standalone Vietnamese Elderly Companion AI microservice built with **FastAPI**, **ChromaDB**, deterministic **Emergency & Medical Guardrails**, and pluggable **RAG Embedding / LLM Providers**.

> **Port & Workspace Isolation**:
> - Default bind: **`127.0.0.1:8001`** (avoids colliding with Docker `mimamori-ai-1` on port **`8000`** and Spring Boot on **`8080`**).
> - Completely decoupled from `ai/`, `backend/`, `app/`, `docker/`, `.env`, and `ai-training/`.

---

## 1. External Virtual Environment & Artifact Paths (Clean Git Tree)

To keep `e:\mimamori` (`git status`) completely clean while running on Windows Python `3.12` (`py -3.12-64`), both the virtual environment and ChromaDB persistence live outside the repository:

- **Python Virtual Environment**: `E:\mimamori_venv\companion_ai`
- **ChromaDB Persistence Directory**: `E:\mimamori_artifacts\chroma` (configurable via `CHROMA_PERSIST_DIR`)

### Setup & Installation

```powershell
# 1. Create external Python 3.12 venv outside repository
py -3.12-64 -m venv E:\mimamori_venv\companion_ai

# 2. Install core dependencies
E:\mimamori_venv\companion_ai\Scripts\python.exe -m pip install -r e:\mimamori\ai-service\requirements.txt

# 3. (Optional, only when enabling EMBEDDING_PROVIDER=huggingface_e5 or local Qwen3 LoRA)
# E:\mimamori_venv\companion_ai\Scripts\python.exe -m pip install sentence-transformers transformers peft torch
```

### Configuration (`.env.example`)

Copy `.env.example` to `.env` inside `ai-service/` (never commit `.env` or API keys):

| Variable | Default | Notes |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `8001` | Localhost-only by default; zero conflict with `ai/` on `8000` |
| `EMBEDDING_PROVIDER` | `hash_dev` | `hash_dev` (offline CPU test/dev fallback) or `huggingface_e5` (`intfloat/multilingual-e5-base` with `"passage: "` / `"query: "` prefixes) |
| `CHROMA_PERSIST_DIR` | `E:\mimamori_artifacts\chroma` | Persistent ChromaDB directory |
| `MODEL_PROVIDER` | `mock` | `mock`, `openai_compatible`, or `transformers_local` (`Qwen/Qwen3-4B-Instruct-2507` + LoRA) |
| `LLM_API_BASE` / `LLM_API_KEY` | empty / `None` | Loaded strictly from environment variables (`SecretStr`) |

---

## 2. Architecture & Safety Guarantees

1. **Deterministic Pre-LLM & Post-LLM Safety (`app/safety/`)**:
   - **High-Risk Emergency Detector**: Normalized Vietnamese + diacritic-free + multi-symptom patterns + negated-vs-affirmative guards for **chest pain (`đau ngực`)**, **difficulty breathing (`khó thở`)**, **fainting (`ngất`)**, **severe falls (`té ngã`)**, **stroke (`đột quỵ`)**, and **severe bleeding (`chảy máu nhiều`)**. Triggers an immediate deterministic response advising contacting family and calling **`115`**, bypasses the LLM, and never gives false reassurance.
   - **Medical Guardrails**: Blocks diagnosis requests, prescription/dosage modifications, and unrecorded medication intake claims both before and after model generation.
2. **Curated Categorized RAG (`app/rag/`)**:
   - Strictly separated across 5 categories: `elderly_care`, `general_health`, `medication_safety`, `app_usage`, and `emergency_guidance`.
   - Every document carries `doc_id`, `source`, `title`, `updated_date`, `version`, `category`, and `review_status` (explicitly distinguishing `reviewed_official_hotline` 115 guidance from `sample_educational_pending_review` / `sample_app_guide`).
   - Enforces `"passage: "` on upsert and `"query: "` on retrieval, supports strict category filtering, and flags missing evidence via `uncertainty_note` and `knowledge_boundary`.
3. **Minimal Spring Boot Contract & Privacy Logging (`app/schemas/`, `app/core/logging.py`)**:
   - `PersonalContextPayload` uses `extra="forbid"` to accept only minimal, non-PII context (`preferred_honorific`, `medication_schedules`, `medication_logs`, `daily_checkin`, `recent_messages`, `health_notes`).
   - `SensitiveDataScrubbingFilter` scrubs JWTs, Bearer tokens, API keys, emails, Vietnamese phone numbers, citizen IDs, and health payload fields from logs.

---

## 3. Running & Testing

```powershell
# Run unit & integration tests (uses temporary ChromaDB dir & hash_dev; no model downloads)
Set-Location e:\mimamori\ai-service
E:\mimamori_venv\companion_ai\Scripts\python.exe -m pytest -v

# Start local FastAPI server on 127.0.0.1:8001
Set-Location e:\mimamori\ai-service
E:\mimamori_venv\companion_ai\Scripts\python.exe main.py
```

### API Endpoints

- `GET /health` — Service liveness (`127.0.0.1:8001`).
- `GET /api/v1/companion/status` — Active embedding provider, ChromaDB index count, categories, and safety gate status.
- `POST /api/v1/companion/chat` — Safety-gated RAG + companion response endpoint.
