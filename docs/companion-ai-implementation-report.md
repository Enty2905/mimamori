# Mimamori AI — Companion AI Implementation Report

> **Phase Status**: Foundation Complete & Independently Verified  
> **Scope**: Implementation report covering `e:\mimamori\ai-training\`, `e:\mimamori\ai-service\`, and `e:\mimamori\docs\`.  
> **Accuracy Notice**: Every file path, symbol name, library version, configuration value, dataset count, and test output below was directly observed in the repository files and independent verification runs. Unexecuted remote GPU training and live cloud inference targets are reported explicitly as `NOT_TESTED`.

---

## 1. Executive Summary & Isolation Compliance

The Companion AI foundation has been delivered as two strictly decoupled top-level projects alongside the existing Mimamori AI monorepo:

1. **[ai-training/](file:///e:/mimamori/ai-training/README.md)**: Offline dataset validation, stratified splitting, Google Colab Free T4 (`15 GB` VRAM, Turing `sm_75`) 4-bit QLoRA configuration, 5 validated Jupyter notebooks, and a deterministic 9-metric evaluation harness with a strict anti-score-fabrication policy.
2. **[ai-service/](file:///e:/mimamori/ai-service/README.md)**: Standalone FastAPI microservice bound by default to `127.0.0.1:8001` featuring a deterministic LLM-independent Vietnamese safety layer (`115` emergency escalation + pre/post-LLM medical guardrails), categorized ChromaDB RAG (`intfloat/multilingual-e5-base` `"passage: "`/`"query: "` wrapper + `hash_dev` offline test embedder), minimal non-PII Spring Boot context schemas (`PersonalContextPayload` with `extra="forbid"`), and PII/JWT log scrubbing.
3. **Documentation (`docs/`)**: Repository audit, system architecture, phased rollout roadmap, evaluation methodology, and this implementation report.

### Untouched Repository & Security Boundary Verification
- **Zero edits/deletions to core monorepo modules**: Independent verification (`git status --short backend/ ai/ docker/ .env`) returned empty—confirming `backend/`, `ai/`, `docker/`, `.env`, `V1__init_schema.sql`, and `V2__health_conditions.sql` remain completely untouched. *(Pre-existing WIP under `app/`—6 modified and 5 untracked files from the prior voice companion sprint with timestamps `2026-11-21 09:46:33–10:15:14`—predated this swarm and was not touched.)*
- **Zero port collision**: `ai-service/` defaults to `127.0.0.1:8001`, leaving `mimamori-ai-1` (`ai/`) undisturbed on port `8000` and Spring Boot on `8080`.
- **Zero large binaries or leaked secrets**: Across `ai-training/`, `ai-service/`, and `docs/`, the largest file is `55,227` bytes (`synthetic_companion_seed.jsonl`), `0` files exceed `100 KB`, `0` model weights/checkpoints or `.env` files exist in git, and regex secret scanning detected only synthetic test fixtures inside `ai-service/tests/test_logging_scrubbing.py`.

---

## 2. Complete File & Directory Inventory

### 2.1 `e:\mimamori\ai-training\` (20 files)
- **Root & Configs**: [.gitignore](file:///e:/mimamori/ai-training/.gitignore), [README.md](file:///e:/mimamori/ai-training/README.md), [model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml), [training_config.yaml](file:///e:/mimamori/ai-training/configs/training_config.yaml)
- **Datasets**:
  - [synthetic_companion_seed.jsonl](file:///e:/mimamori/ai-training/datasets/raw/synthetic_companion_seed.jsonl) (`32` dialogues)
  - `datasets/processed/`: [train.jsonl](file:///e:/mimamori/ai-training/datasets/processed/train.jsonl) (`16`), [val.jsonl](file:///e:/mimamori/ai-training/datasets/processed/val.jsonl) (`8`), [test.jsonl](file:///e:/mimamori/ai-training/datasets/processed/test.jsonl) (`8`)
  - [eval_benchmark.jsonl](file:///e:/mimamori/ai-training/datasets/evaluation/eval_benchmark.jsonl) (`20` cases)
- **Scripts & Tests**:
  - [validate_dataset.py](file:///e:/mimamori/ai-training/scripts/validate_dataset.py)
  - [prepare_dataset.py](file:///e:/mimamori/ai-training/scripts/prepare_dataset.py)
  - [evaluate_model.py](file:///e:/mimamori/ai-training/scripts/evaluate_model.py)
  - [test_dataset_and_eval.py](file:///e:/mimamori/ai-training/tests/test_dataset_and_eval.py)
- **Notebooks**:
  - [01_environment_check.ipynb](file:///e:/mimamori/ai-training/notebooks/01_environment_check.ipynb)
  - [02_dataset_preparation.ipynb](file:///e:/mimamori/ai-training/notebooks/02_dataset_preparation.ipynb)
  - [03_baseline_evaluation.ipynb](file:///e:/mimamori/ai-training/notebooks/03_baseline_evaluation.ipynb)
  - [04_lora_training.ipynb](file:///e:/mimamori/ai-training/notebooks/04_lora_training.ipynb)
  - [05_model_comparison.ipynb](file:///e:/mimamori/ai-training/notebooks/05_model_comparison.ipynb)
- **Outputs**: [.gitkeep](file:///e:/mimamori/ai-training/outputs/.gitkeep), [dataset_quality_report.json](file:///e:/mimamori/ai-training/outputs/dataset_quality_report.json), [dataset_quality_report.md](file:///e:/mimamori/ai-training/outputs/dataset_quality_report.md), [eval_results.json](file:///e:/mimamori/ai-training/outputs/eval_results.json), [eval_summary.csv](file:///e:/mimamori/ai-training/outputs/eval_summary.csv)

### 2.2 `e:\mimamori\ai-service\` (32 files + External Runtime Paths)
- **Root**: [.env.example](file:///e:/mimamori/ai-service/.env.example), [.gitignore](file:///e:/mimamori/ai-service/.gitignore), [README.md](file:///e:/mimamori/ai-service/README.md), [requirements.txt](file:///e:/mimamori/ai-service/requirements.txt), [main.py](file:///e:/mimamori/ai-service/main.py)
- **Core, Schemas & API**:
  - `app/__init__.py`, `app/core/__init__.py`, [config.py](file:///e:/mimamori/ai-service/app/core/config.py), [logging.py](file:///e:/mimamori/ai-service/app/core/logging.py)
  - `app/schemas/__init__.py`, [companion.py](file:///e:/mimamori/ai-service/app/schemas/companion.py)
  - `app/api/__init__.py`, [routes.py](file:///e:/mimamori/ai-service/app/api/routes.py)
- **Safety, RAG, Providers & Orchestration**:
  - `app/safety/__init__.py`, [policies.py](file:///e:/mimamori/ai-service/app/safety/policies.py), [detector.py](file:///e:/mimamori/ai-service/app/safety/detector.py)
  - `app/rag/__init__.py`, [knowledge_loader.py](file:///e:/mimamori/ai-service/app/rag/knowledge_loader.py), [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py)
  - `app/rag/knowledge/`: [elderly_care.json](file:///e:/mimamori/ai-service/app/rag/knowledge/elderly_care.json), [general_health.json](file:///e:/mimamori/ai-service/app/rag/knowledge/general_health.json), [medication_safety.json](file:///e:/mimamori/ai-service/app/rag/knowledge/medication_safety.json), [app_usage.json](file:///e:/mimamori/ai-service/app/rag/knowledge/app_usage.json), [emergency_guidance.json](file:///e:/mimamori/ai-service/app/rag/knowledge/emergency_guidance.json)
  - `app/models/__init__.py`, [provider.py](file:///e:/mimamori/ai-service/app/models/provider.py)
  - `app/services/__init__.py`, [companion_service.py](file:///e:/mimamori/ai-service/app/services/companion_service.py)
- **Tests**: `tests/__init__.py`, [conftest.py](file:///e:/mimamori/ai-service/tests/conftest.py), [test_api_and_schemas.py](file:///e:/mimamori/ai-service/tests/test_api_and_schemas.py), [test_safety_layer.py](file:///e:/mimamori/ai-service/tests/test_safety_layer.py), [test_rag_retriever.py](file:///e:/mimamori/ai-service/tests/test_rag_retriever.py), [test_logging_scrubbing.py](file:///e:/mimamori/ai-service/tests/test_logging_scrubbing.py), [test_providers.py](file:///e:/mimamori/ai-service/tests/test_providers.py)
- **External Artifact & Environment Paths (Outside Git)**:
  - Python venv: `E:\mimamori_venv\companion_ai`
  - Default ChromaDB persistence directory: `E:\mimamori_artifacts\chroma`

### 2.3 `e:\mimamori\docs\` (5 Companion AI Documents)
- [ai-repository-audit.md](file:///e:/mimamori/docs/ai-repository-audit.md)
- [companion-ai-architecture.md](file:///e:/mimamori/docs/companion-ai-architecture.md)
- [companion-ai-roadmap.md](file:///e:/mimamori/docs/companion-ai-roadmap.md)
- [companion-ai-evaluation.md](file:///e:/mimamori/docs/companion-ai-evaluation.md)
- [companion-ai-implementation-report.md](file:///e:/mimamori/docs/companion-ai-implementation-report.md)

---

## 3. Model Strategy, Configuration & Environment Versions

### 3.1 Model Configuration ([model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml))

| Role | Identifier / Alias | Architecture & Version Gate | Key Design & Safety Notes |
| :--- | :--- | :--- | :--- |
| **Primary Fine-Tuning Model** | `Qwen/Qwen3-4B-Instruct-2507` (`qwen3_4b_instruct_2507`) | `model_type: qwen3`, `arch: Qwen3ForCausalLM`, `auto_class: AutoModelForCausalLM`, `min_transformers_version: "4.51.0"`, `recommended_transformers_version: "4.57.6"` | Non-thinking only (`enable_thinking: false`), `262,144` native context, `lora_target_modules`: `[q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj]`, 4-bit NF4 QLoRA `float16` compute (~`6.5–9.5 GB` VRAM on T4). |
| **Comparison Model** | `Qwen/Qwen3.5-4B` (`qwen3_5_4b`) | `model_type: qwen3_5`, `arch: Qwen3_5ForConditionalGeneration` (`text_only_compat_arch: Qwen3_5ForCausalLM`), `auto_class: AutoProcessor`, `min_transformers_version: "5.2.0"` | Thinking ON by default (`enable_thinking: false` passed explicitly in SFT/eval); hybrid 3:1 GatedDeltaNet `linear_attn` + `full_attention` + vision; `qlora_4bit_recommended: false` due to quantization divergence and `NaN` / slow fallback risk on T4. |
| **Cloud Fallback Baseline** | `openai/gpt-oss-120b` -> `openai/gpt-oss-20b` (`groq_fallback`) | Groq OpenAI-compatible (`https://api.groq.com/openai/v1`), `api_key_env: GROQ_API_KEY` | Mirrors `backend/GroqService.java`; timeout `20s`, `max_tokens: 256`, `temperature: 0.6`; no hardcoded key. |
| **RAG Embedding Spec** | `intfloat/multilingual-e5-base` (`XLMRobertaModel`, `768` dims, `512` max tokens) | Enforces `passage_prefix: "passage: "` and `query_prefix: "query: "` | ~`1.8–3.0 GB` estimated Windows CPU RAM (`lightweight_fallback: intfloat/multilingual-e5-small`). |

### 3.2 Training Hyperparameters ([training_config.yaml](file:///e:/mimamori/ai-training/configs/training_config.yaml))
- **Hardware Target**: `google_colab_free_t4`, `NVIDIA Tesla T4`, `vram_gb: 15.0`, `compute_capability: "7.5"`, `supports_bf16: false`, `supports_flash_attention_2: false`.
- **QLoRA & SFT Settings**: `load_in_4bit: true`, `bnb_4bit_quant_type: nf4`, `bnb_4bit_compute_dtype: float16`, `bnb_4bit_use_double_quant: true`, `r: 16`, `lora_alpha: 32`, `lora_dropout: 0.05`, `bias: none`, `task_type: CAUSAL_LM`, `per_device_train_batch_size: 2`, `gradient_accumulation_steps: 8`, `max_seq_length: 1024`, `fp16: true`, `bf16: false`, `optim: paged_adamw_8bit`, `gradient_checkpointing: true` (`use_reentrant: false`), `num_train_epochs: 3`, `learning_rate: 0.0002`, `save_total_limit: 3`, `resume_from_checkpoint: true`.
- **T4 OOM Fallback (`t4_oom_fallback`)**: `batch_size: 1`, `per_device_train_batch_size: 1`, `per_device_eval_batch_size: 1`, `gradient_accumulation_steps: 16`, `max_seq_length: 768`, `fp16: true`, `bf16: false`, `gradient_checkpointing: true`.
- **Drive Persistence & Review Gate**: `drive_root: /content/drive/MyDrive/mimamori_companion_ai`; `safety_and_review_gate.require_human_review_before_production_training: true` (`min_recommended_reviewed_examples: 200`).

### 3.3 Observed Local Python & Package Versions
- **`py -3.12-64` (Windows Host, `ai-training` verification)**: `Python 3.12.7`, `pyyaml 6.0.1`, `nbformat 5.10.4`, `pytest 7.4.4`.
- **`E:\mimamori_venv\companion_ai\Scripts\python.exe` (`ai-service` runtime)**: `Python 3.12.7`, `fastapi 0.165.0`, `pydantic 2.14.4`, `pydantic-settings 2.16.3`, `chromadb 1.5.9`, `httpx 0.28.1`, `pytest 9.2.0`, `uvicorn 0.54.0`, `pyyaml 6.0.4`, `python-dotenv 1.2.4`.

---

## 4. Datasets, Splitting, Quality Report & Review Gate

All data metrics below come directly from [dataset_quality_report.json](file:///e:/mimamori/ai-training/outputs/dataset_quality_report.json) generated by [validate_dataset.py](file:///e:/mimamori/ai-training/scripts/validate_dataset.py) and [prepare_dataset.py](file:///e:/mimamori/ai-training/scripts/prepare_dataset.py):

| Dataset | File | Records | Single-Turn | Multi-Turn | Source | `reviewed=false` | PII Hits | Safety Errors |
| :--- | :--- |---:|---:|---:|---|---:|---:|---:|
| `raw_seed` | [synthetic_companion_seed.jsonl](file:///e:/mimamori/ai-training/datasets/raw/synthetic_companion_seed.jsonl) | `32` | `20` | `12` | `synthetic_mimamori_seed_v1` | `32` | `0` | `0` |
| `train` | [train.jsonl](file:///e:/mimamori/ai-training/datasets/processed/train.jsonl) | `16` | `6` | `10` | `synthetic_mimamori_seed_v1` | `16` | `0` | `0` |
| `val` | [val.jsonl](file:///e:/mimamori/ai-training/datasets/processed/val.jsonl) | `8` | `7` | `1` | `synthetic_mimamori_seed_v1` | `8` | `0` | `0` |
| `test` | [test.jsonl](file:///e:/mimamori/ai-training/datasets/processed/test.jsonl) | `8` | `7` | `1` | `synthetic_mimamori_seed_v1` | `8` | `0` | `0` |
| `eval_benchmark` | [eval_benchmark.jsonl](file:///e:/mimamori/ai-training/datasets/evaluation/eval_benchmark.jsonl) | `20` | `14` | `6` | `synthetic_eval_benchmark_v1` | `20` | `0` | `0` |

- **8-Category Stratified Coverage**: All 8 required categories (`daily_conversation`, `emotional_support`, `elderly_companionship`, `daily_routines`, `medication_assistance`, `basic_health_information`, `emergency_situations`, `unclear_or_insufficient_information`) have exactly `4` records in `raw_seed`, `2` in `train`, `1` in `val`, `1` in `test`, and `2–4` in `eval_benchmark`.
- **4 Safety Levels Covered**: `raw_seed` (`low: 16`, `medium: 8`, `high: 5`, `critical: 3`); `eval_benchmark` (`low: 8`, `medium: 5`, `high: 4`, `critical: 3`).
- **Assistant Length (`raw_seed`)**: `min=142`, `max=310`, `avg=217.6` characters (concise for TTS playback).
- **Leakage Check (`zero_leakage: true`)**: `0` `id_overlap`, `0` `conversation_overlap`, and `0` `user_turn_overlap` across all 7 split/benchmark pair comparisons (`train__vs__val`, `train__vs__test`, `val__vs__test`, `train__vs__eval_benchmark`, `val__vs__eval_benchmark`, `test__vs__eval_benchmark`, `raw_seed__vs__eval_benchmark`).
- **Validation Status**: `passed: true`, `errors: 0`, `warnings: 5` (explicit warnings that all 5 sets currently have `reviewed=false` and require clinical/geriatric review prior to production SFT).

---

## 5. Google Colab Free T4 Notebooks

All 5 bilingual (English/Vietnamese) Colab notebooks under `ai-training/notebooks/` conform to `nbformat 4.5` (`ast.parse` clean across every code cell) and read keys directly from `model_config.yaml` and `training_config.yaml`:

| Notebook | Cells (`md`/`code`) | Primary Responsibilities & T4 Safeguards |
| :--- | :---: | :--- |
| [01_environment_check.ipynb](file:///e:/mimamori/ai-training/notebooks/01_environment_check.ipynb) | `11` (`6`/`5`) | Mounts Drive (`/content/drive/MyDrive/mimamori_companion_ai`), inspects GPU/CUDA (`torch.cuda.get_device_properties`), checks `transformers >= 4.51.0` (Qwen3) vs `>= 5.2.0` (Qwen3.5), `peft`/`trl`/`bitsandbytes`/`accelerate`/`datasets`, and `GROQ_API_KEY` secret presence without downloading weights. |
| [02_dataset_preparation.ipynb](file:///e:/mimamori/ai-training/notebooks/02_dataset_preparation.ipynb) | `11` (`6`/`5`) | Runs `prepare_dataset.py` & `validate_dataset.py --require-processed`, inspects 8-category balance and `zero_leakage`, supports optional Qwen3 tokenizer token-length inspection (`RUN_TOKENIZER_DISTRIBUTION=False` default), and syncs splits/reports to Drive `processed_data/` and `eval_outputs/`. |
| [03_baseline_evaluation.ipynb](file:///e:/mimamori/ai-training/notebooks/03_baseline_evaluation.ipynb) | `11` (`6`/`5`) | Evaluates `qwen3_4b_instruct_2507`, `qwen3_5_4b` (guarded by `transformers >= 5.2.0` + `enable_thinking=False`; records `NOT_SUPPORTED`/`FAILED` cleanly), and optional `groq_fallback` (via `google.colab.userdata.get('GROQ_API_KEY')`) in isolated subprocesses to free VRAM, writing `baseline_eval_results.json` & `.csv` to Drive. |
| [04_lora_training.ipynb](file:///e:/mimamori/ai-training/notebooks/04_lora_training.ipynb) | `15` (`8`/`7`) | Enforces pre-flight review gate (`ALLOW_SYNTHETIC_SMOKE_TEST=False`, `CONFIRM_REVIEWED_DATASET_FOR_FULL_TRAINING=False`), flags `Qwen/Qwen3.5-4B` GatedDeltaNet 4-bit divergence warning, runs 4-bit NF4 QLoRA (`fp16`, `paged_adamw_8bit`) with automatic `t4_oom_fallback` (`batch_size=1`, `grad_accum=16`, `max_seq_length=768`), persists Drive checkpoints (`save_total_limit=3`, `resume_from_checkpoint=True`), saves adapter + tokenizer + `training_metadata.json`, and evaluates `test.jsonl` + `eval_benchmark.jsonl`. |
| [05_model_comparison.ipynb](file:///e:/mimamori/ai-training/notebooks/05_model_comparison.ipynb) | `9` (`5`/`4`) | Compares Base Qwen3 vs LoRA Qwen3 vs Qwen3.5-4B vs Groq strictly from saved Drive/local JSON/CSV artifacts, displays `NOT_TESTED`/`NOT_SUPPORTED`/`FAILED` honestly, isolates `mock_dev`, computes deltas only when both targets are `TESTED_SUCCESSFULLY`, and writes `model_comparison_summary.csv` & `.md`. |

---

## 6. Evaluation Harness & Honest Benchmark Results

Implemented in [evaluate_model.py](file:///e:/mimamori/ai-training/scripts/evaluate_model.py) and documented in [companion-ai-evaluation.md](file:///e:/mimamori/docs/companion-ai-evaluation.md):

- **9 Deterministic Metrics**: `vietnamese_naturalness`, `empathy`, `clarity_for_elderly`, `multi_turn_consistency`, `instruction_following`, `medical_safety`, `hallucination` (lower is better), `medication_accuracy`, and `latency_ms`.
- **4 Explicit Execution Statuses**: `TESTED_SUCCESSFULLY`, `NOT_TESTED`, `NOT_SUPPORTED`, `FAILED` (`null` summary metrics whenever not `TESTED_SUCCESSFULLY`).

### Observed Results in [eval_results.json](file:///e:/mimamori/ai-training/outputs/eval_results.json) & [eval_summary.csv](file:///e:/mimamori/ai-training/outputs/eval_summary.csv) (`--mock` Run)

| Target | `is_mock` | `execution_status` | Cases | `vietnamese_naturalness` | `empathy` | `clarity_for_elderly` | `multi_turn_consistency` | `instruction_following` | `medical_safety` | `hallucination` | `medication_accuracy` | `latency_ms` |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `groq_fallback` | `false` | `NOT_TESTED` | `0` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` |
| `qwen3_4b_instruct_2507` | `false` | `NOT_TESTED` | `0` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` |
| `qwen3_5_4b` | `false` | `NOT_TESTED` | `0` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` |
| `mock_dev` | `true` | `TESTED_SUCCESSFULLY` | `20` | `1.0` | `0.876` | `1.0` | `0.9583` | `1.0` | `1.0` | `0.0` | `1.0` | `0.057` |

*(No real LLM inference scores were fabricated; `mock_dev` validates the 9-metric scoring and serialization pipeline only.)*

---

## 7. Standalone `ai-service/` Runtime, Endpoints & Providers

- **Server & Configuration ([config.py](file:///e:/mimamori/ai-service/app/core/config.py), [main.py](file:///e:/mimamori/ai-service/main.py))**:
  - `Settings` (`pydantic-settings` `BaseSettings`) defaults to `host="127.0.0.1"`, `port=8001`, `embedding_provider="hash_dev"`, `embedding_model_name="intfloat/multilingual-e5-base"`, `embedding_dimension=768`, `chroma_persist_dir=r"E:\mimamori_artifacts\chroma"`, `model_provider="mock"`, `base_model_id="Qwen/Qwen3-4B-Instruct-2507"`.
  - Secrets (`llm_api_key`, `service_auth_token`) use `SecretStr | None = None` with zero hardcoded defaults.
- **HTTP Endpoints ([routes.py](file:///e:/mimamori/ai-service/app/api/routes.py))**:
  - `GET /health` -> `HealthResponse` (`status: "ok"`, `service`, `version`, `port: 8001`).
  - `GET /api/v1/companion/status` -> `CompanionStatusResponse` (`status`, `embedding_provider`, `embedding_model_name`, `model_provider`, `model_provider_configured`, `chroma_persist_dir`, `collection_name`, `indexed_documents`, `categories`, `safety_layer_active`).
  - `POST /api/v1/companion/chat` -> accepts `CompanionChatRequest`, returns `CompanionChatResponse`, and registers privacy-safe structured handlers (`RequestValidationError` -> `422 validation_error`, `ProviderConfigurationError` -> `503 provider_unavailable`, `HTTPException`, `Exception` -> `500 internal_server_error`).
- **Model Providers ([provider.py](file:///e:/mimamori/ai-service/app/models/provider.py))**:
  - `ModelProvider` abstract interface implemented by:
    1. `MockModelProvider` (`provider_name = "mock_companion_provider"`): deterministic offline responder for dev/CI.
    2. `OpenAICompatibleProvider` (`provider_name = "openai_compatible"`): async `httpx` `/chat/completions` client requiring `LLM_API_BASE` + `LLM_API_KEY`.
    3. `TransformersLocalAdapterProvider` (`provider_name = "transformers_local_adapter"`): lazy-loading `AutoModelForCausalLM` + `PeftModel` hook for `Qwen/Qwen3-4B-Instruct-2507` + `LORA_ADAPTER_PATH`.
- **Orchestration ([companion_service.py](file:///e:/mimamori/ai-service/app/services/companion_service.py))**:
  - `CompanionService.handle_chat` executes: `SafetyDetector.evaluate_input` -> (if `bypass_llm`, optional `emergency_guidance` `115` retrieval & immediate return via `provider="deterministic_safety_gate"`) -> `ChromaKnowledgeRetriever.retrieve` -> (`insufficient_evidence` gate if `include_general_knowledge=False`) -> `ModelProvider.generate` -> `SafetyDetector.validate_output` -> structured `CompanionChatResponse`.

---

## 8. Deterministic Safety, ChromaDB RAG & Privacy Architecture

### 8.1 Deterministic Safety Layer ([policies.py](file:///e:/mimamori/ai-service/app/safety/policies.py), [detector.py](file:///e:/mimamori/ai-service/app/safety/detector.py))
- **Pre-LLM Emergency Gate**: `normalize_vietnamese` folds `đ->d` and strips diacritics so both accented and diacritic-free inputs match `EMERGENCY_RULES` (`chest_pain`, `difficulty_breathing`, `fainting`, `severe_fall`, `stroke`, `severe_bleeding`), `INABILITY_EMERGENCY_PATTERNS`, `CRITICAL_SOLO_WARNING_PHRASES`, and `MULTI_SYMPTOM_CRITICAL_PAIRS`—while `_is_negated_or_preventive` and `BENIGN_EXCLUSION_PHRASES` prevent false positives on negated/preventive phrases (e.g., *"không đau ngực"*, *"ngạt mũi"*, *"ngã tư"*). Triggers `risk_level="critical"`, `bypass_llm=True`, `knowledge_boundary="emergency_protocol"`, `guardrail_flags=["emergency_115_escalation"]`, advising family contact + calling `115` with zero `FALSE_REASSURANCE_PHRASES`.
- **Pre/Post-LLM Medical Guardrails**:
  - Pre-LLM intercepts diagnosis requests (`DIAGNOSIS_REQUEST_PHRASES`), prescription/dosage changes (`PRESCRIPTION_DOSAGE_REQUEST_PHRASES`), and requests to mark unrecorded doses as taken (`UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS`).
  - `SafetyDetector.validate_output` scans generated replies against `POST_LLM_DIAGNOSIS_PATTERNS`, `POST_LLM_DOSAGE_PATTERNS`, `FALSE_REASSURANCE_PHRASES`, and `POST_LLM_TAKEN_CLAIM_PATTERNS` (cross-checked against `PersonalContextPayload.medication_logs` `status == "TAKEN"`).

### 8.2 ChromaDB RAG & Provenance ([knowledge_loader.py](file:///e:/mimamori/ai-service/app/rag/knowledge_loader.py), [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py))
- **14 Curated Docs Across 5 Isolated Categories**: `elderly_care` (`3`), `general_health` (`3`), `medication_safety` (`3`), `app_usage` (`3`), `emergency_guidance` (`2`).
- **Strict Review Status Provenance**: Only `emergency_guidance_01` (Vietnam `115` hotline) carries `review_status: "reviewed_official_hotline"`; the 3 `app_usage` docs carry `"sample_app_guide"`; all 10 educational/health/medication/preparedness docs carry `"sample_educational_pending_review"`. `load_knowledge_documents` rejects unallowed categories, category mismatches, or unauthorized `reviewed_official_hotline` tags.
- **Prefix & Embedding Design**: `BasePrefixEmbedder` (`HashDevEmbedder` 768d default offline embedder + lazy `HuggingFaceE5Embedder` for `intfloat/multilingual-e5-base`) and `ChromaPrefixEmbeddingAdapter` enforce `"passage: "` on upsert and `"query: "` on retrieval against `chromadb.PersistentClient` (`hnsw:space: cosine`, `anonymized_telemetry=False`). Missing evidence populates `uncertainty_note` and sets `knowledge_boundary` to `general_guidance_only` or `insufficient_evidence`.

### 8.3 Minimal Context Schema & Log Scrubbing ([companion.py](file:///e:/mimamori/ai-service/app/schemas/companion.py), [logging.py](file:///e:/mimamori/ai-service/app/core/logging.py))
- `PersonalContextPayload` (`extra="forbid"`) accepts only `preferred_honorific`, `medication_schedules` (`<= 10`), `medication_logs` (`<= 15`), `daily_checkin`, `recent_messages` (`<= 6`, normalizing `AI`/`ai` -> `assistant`), and `health_notes` (`<= 10`), rejecting raw JWTs, API keys, emails, Vietnamese phone numbers, and 9/12-digit citizen IDs via `_PII_REJECT_PATTERNS`.
- `SensitiveDataScrubbingFilter`, `scrub_sensitive_text`, and `sanitize_log_payload` redact JWTs, Bearer headers, API keys, emails, phones, citizen IDs, and sensitive health/message keys across `mimamori.ai_service`, `uvicorn`, and `httpx` loggers while keeping `115` intact.

---

## 9. Observed Verification Commands & Results

All verification commands below were executed directly by independent verification (`BypassSandbox: true`):

| Target | Exact Command | Exit Code | Observed Result |
|---|---|---:|---|
| Dataset Prep | `py -3.12-64 e:\mimamori\ai-training\scripts\prepare_dataset.py` | `0` | `raw_count: 32`, `excluded_eval_overlap_ids: []`, `split_counts: {"train": 16, "val": 8, "test": 8}`, `validation_passed: true`, `zero_leakage: true`, `errors: []` |
| Dataset Validation | `py -3.12-64 e:\mimamori\ai-training\scripts\validate_dataset.py --require-processed` | `0` | `passed: true`, `errors: 0`, `warnings: 5` (`reviewed=false` notices), `zero_leakage: true` |
| Eval Harness (`--mock`) | `py -3.12-64 e:\mimamori\ai-training\scripts\evaluate_model.py --mock` | `0` | `total_benchmark_cases: 20`; `groq_fallback`, `qwen3_4b_instruct_2507`, `qwen3_5_4b` = `NOT_TESTED` (`null` metrics); `mock_dev` = `TESTED_SUCCESSFULLY` |
| `ai-training` Unittest | `py -3.12-64 -m unittest discover -s e:\mimamori\ai-training\tests -v` | `0` | `Ran 11 tests in 0.199s — OK` |
| `ai-training` Pytest | `py -3.12-64 -m pytest e:\mimamori\ai-training\tests\test_dataset_and_eval.py -v` | `0` | `11 passed in 0.35s` |
| Notebooks Validation | `nbformat.reads(..., as_version=4)` + `nbformat.validate` + `ast.parse` (via `py -3.12-64`) | `0` | `5/5` valid `nbformat 4.5` (`01`: `11`, `02`: `11`, `03`: `11`, `04`: `15`, `05`: `9` cells; `valid: True`, `ast_ok: True`), plus offline cell smoke tests |
| `ai-service` Pytest | `Set-Location e:\mimamori\ai-service; E:\mimamori_venv\companion_ai\Scripts\python.exe -m pytest -v` | `0` | **`45 passed in 6.88s`** (0 failures across API/schemas, safety layer, RAG retriever, log scrubbing, and providers) |
| FastAPI `TestClient` Smoke | `TestClient(main.app)` against `GET /health`, `GET /api/v1/companion/status`, `POST /api/v1/companion/chat` | `0` | `/health` `200` (`port: 8001`, `status: ok`); `/status` `200` (`indexed_documents: 14`, all 5 categories, `safety_layer_active: true`); `/chat` normal `200` (`knowledge_boundary: general_guidance_only`, `missing_evidence_uncertainty`); `/chat` (`"Dau nguc kho tho qua chau oi"`) `200` (`safety_triggered: true`, `risk_level: critical`, `provider: deterministic_safety_gate`, `guardrail_flags: ["emergency_115_escalation"]`, `evidence_sources[0].doc_id: "emergency_guidance_01"`) |

---

## 10. Known Limitations, Honest Gaps & Next Actions

1. **No Live Fine-Tuning or GPU Inference Run Yet**: Because the local Windows host (`16 GB` RAM, CPU-only) has no CUDA GPU and Colab T4 notebooks have not yet been run remotely, `qwen3_4b_instruct_2507`, `qwen3_5_4b`, and `groq_fallback` are honestly marked `NOT_TESTED`.
2. **Unreviewed Seed & Sample Knowledge Content**: `synthetic_companion_seed.jsonl` (`32` dialogues) and `eval_benchmark.jsonl` (`20` cases) carry `reviewed: false`, and 10 knowledge base documents carry `sample_educational_pending_review`. They must undergo geriatric/clinical review and expansion (recommended `>= 200` reviewed training dialogues) before production QLoRA training.
3. **Offline Embedding Mode Used in Tests**: Automated tests verify ChromaDB persistence, category isolation, and `"passage: "`/`"query: "` prefix formatting with `hash_dev` (`EMBEDDING_PROVIDER=hash_dev`) and a stubbed `sentence_transformers` test double rather than downloading the `1.11 GB` `intfloat/multilingual-e5-base` weights into CI/test runs.
4. **Spring Boot Integration Still Pending (By Design)**: `backend/` was intentionally not modified (`ConversationService.fetchAiCompanionReply` still invokes `GroqService` first, and its secondary `/api/companion/chat` branch targets port `8000` without personal context).

### Recommended Immediate Next Steps
1. Conduct human cultural/clinical review of `ai-training/datasets/` and `ai-service/app/rag/knowledge/`, flipping `reviewed: true` and updating `review_status` where approved.
2. Execute `notebooks/01_environment_check.ipynb` through `05_model_comparison.ipynb` on Google Colab Free T4 (`15 GB`) with `GROQ_API_KEY` stored in Colab Secrets to obtain empirical baseline vs QLoRA vs Groq scores.
3. Wire Spring Boot (`ConversationService`) to `http://127.0.0.1:8001/api/v1/companion/chat` using the sanitized `PersonalContextPayload` contract, preserving `GroqService` failover, and begin shadow-mode validation.
