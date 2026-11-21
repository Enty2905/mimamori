# Mimamori AI — Companion AI Phase G Real Smoke Test & Audit Report

> **Phase Status**: Phase G Local Verification Complete (Colab GPU Execution `NOT_TESTED` Locally)  
> **Generated**: 2026-11-21  
> **Scope**: Independent verification of Phase G configuration audit, real `intfloat/multilingual-e5-base` + ChromaDB RAG smoke test, Colab Free T4 `03_baseline_evaluation.ipynb` Part B readiness, expanded 10-class Vietnamese safety diagnostics, and real `OpenAICompatibleProvider` Groq smoke test.  
> **Accuracy & Anti-Fabrication Notice**: Every number, version, path, symbol name, latency, RAM metric, and test outcome in this report was directly observed in repository files, generated JSON/CSV artifacts, and independent verification command runs. No 4B LLM weights were downloaded locally, no paid compute was triggered, and unexecuted Colab GPU targets are marked explicitly as `NOT_TESTED`.

---

## 1. Executive Summary & Repository Isolation Audit

| Phase G Workstream | Outcome | Key Verified Result | Evidence / Output |
| :--- | :---: | :--- | :--- |
| **Monorepo & Secret Boundary Audit** | **PASS** | `0` edits in `backend/`, `ai/`, `docker/`, `.env`, or DB migrations; `0` 4B weights or leaked keys in repo | `git status --short`, secret scan |
| **Section 2: Config Audit** | **PASS** | Safe dev defaults intact (`mock`, `hash_dev`, `127.0.0.1:8001`); `RAG_MIN_SIMILARITY_SCORE` gap flagged for `huggingface_e5` | [config.py](file:///e:/mimamori/ai-service/app/core/config.py), [model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml) |
| **Section 3: Real `multilingual-e5-base` RAG** | **PASS** | `35` queries (`30` in-domain + `5` OOD), `768`d, persistence + `5/5` category filters + `5/5` OOD empty retrieval (`0.795` threshold) | [rag_smoke_test.json](file:///e:/mimamori/ai-training/outputs/rag_smoke_test.json), [rag_smoke_test.csv](file:///e:/mimamori/ai-training/outputs/rag_smoke_test.csv) |
| **Section 4: Colab `Qwen3-4B` Smoke Prep** | **READY** (`NOT_TESTED` locally) | `03_baseline_evaluation.ipynb` Part B (Steps B1–B7) validated (`26` cells, `nbformat 4.5`, `ast.parse` clean); local GPU `NOT_TESTED` | [03_baseline_evaluation.ipynb](file:///e:/mimamori/ai-training/notebooks/03_baseline_evaluation.ipynb) |
| **Section 5: Expanded Safety Audit** | **PASS** | `54` cases across `10` classes: `27/54` (`13` FP, `13` FN, `1` risk mismatch) before -> `54/54` (`0` FP, `0` FN) after | [safety_smoke_test.json](file:///e:/mimamori/ai-training/outputs/safety_smoke_test.json), [test_safety_smoke_expanded.py](file:///e:/mimamori/ai-service/tests/test_safety_smoke_expanded.py) |
| **Section 6: Real Groq Provider Smoke** | **PASS** | `5/5` direct prompts HTTP `200` (`978.67–1339.40 ms`) + `2/2` `CompanionService` checks (non-emergency Groq + emergency `115` bypass) | [provider_smoke_test.json](file:///e:/mimamori/ai-training/outputs/provider_smoke_test.json), [provider.py](file:///e:/mimamori/ai-service/app/models/provider.py) |
| **Full Automated Test Suites** | **PASS** | `ai-service`: **`110 passed in 8.17s`**; `ai-training`: **`11 passed in 0.28s`** | Independent post-edit `pytest` runs |

### Repository & Security Integrity Checks
- **Protected Monorepo Paths Untouched**: `git -C e:\mimamori diff --name-only backend/ ai/ docker/ .env` returned empty (`0` modified files). Flyway migrations (`V1__init_schema.sql`, `V2__health_conditions.sql`) remain untouched.
- **Mobile `app/` Untouched by Phase G**: `git -C e:\mimamori status --short` shows only pre-Phase-G voice companion files under `app/` (`app.config.ts`, `package.json`, `package-lock.json`, `AIAvatar.tsx`, `client.ts`, `ElderlyCompanionScreen.tsx`, `VoiceControlPanel.tsx`, `VoiceWaveform.tsx`, `core/voice/`) with modification timestamps `2026-11-21 09:46:33–10:14:11`, all predating Phase G (`11:54+`).
- **Zero Large Weights or Secrets Committed**:
  - Recursive scan for `*.safetensors`, `*.bin`, `*.gguf`, `*.pt`, `*.pth` across `ai-training/`, `ai-service/`, and `docs/` returned `0` files.
  - Regex secret scan (`gsk_...`, `hf_...`, `sk-...`, `AIza...`) across `ai-training/`, `ai-service/`, and `docs/` matched only 4 synthetic test-fixture strings inside [test_logging_scrubbing.py](file:///e:/mimamori/ai-service/tests/test_logging_scrubbing.py#L19-L101). Zero real API keys or tokens appear in `safety_smoke_test.json`, `provider_smoke_test.json`, `rag_smoke_test.json`, or any tracked file.
  - `e:\mimamori\ai-service\.env` does not exist (`False`); `GROQ_API_KEY` was read strictly in-memory during Section 6 smoke execution.
- **Drive C Protection**: Hugging Face and SentenceTransformers caches were forced onto Drive E (`HF_HOME=E:\mimamori_artifacts\hf_cache`, `SENTENCE_TRANSFORMERS_HOME=E:\mimamori_artifacts\hf_cache`, totaling `1082.09 MB`); ChromaDB smoke persistence used `E:\mimamori_artifacts\chroma_smoke_g`. `C:\Users\Dell\.cache\huggingface` does not exist (`False`).

---

## 2. Configuration Audit (Observed Defaults)

All safe offline development defaults remain intact across both projects:

| Setting / Symbol | Audited Default | Source File |
| :--- | :--- | :--- |
| `Settings.host` / `Settings.port` | `"127.0.0.1"` / `8001` (avoids `8000` & `8080` collisions) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L33-L34) |
| `Settings.environment` / `Settings.log_level` | `"development"` / `"INFO"` | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L32-L35) |
| `Settings.model_provider` | `"mock"` (`Literal["mock", "openai_compatible", "transformers_local"]`; `build_model_provider` -> `MockModelProvider` / `mock_companion_provider`) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L48), [provider.py](file:///e:/mimamori/ai-service/app/models/provider.py#L340-L346) |
| `Settings.llm_model_name` / `llm_api_base` / `llm_api_key` | `"openai/gpt-oss-120b"` / `""` / `None` (`SecretStr`, `service_auth_token=None`, `timeout=20.0`, `max_tokens=320`, `temperature=0.3`) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L49-L61) |
| `Settings.base_model_id` / `Settings.lora_adapter_path` | `"Qwen/Qwen3-4B-Instruct-2507"` / `""` (`TransformersLocalAdapterProvider` lazy-loads only if path & libs exist) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L57-L58), [provider.py](file:///e:/mimamori/ai-service/app/models/provider.py#L239-L270) |
| `Settings.embedding_provider` | `"hash_dev"` (`Literal["hash_dev", "huggingface_e5"]`; `build_embedder` -> `HashDevEmbedder(dimension=768)`) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L38), [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py#L280-L284) |
| `Settings.embedding_model_name` / `embedding_dimension` | `"intfloat/multilingual-e5-base"` / `768` (`HuggingFaceE5Embedder` lazy-loads CPU `SentenceTransformer`; `"passage: "` & `"query: "` prefixes enforced) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L39-L40), [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py#L228-L277) |
| `Settings.chroma_persist_dir` / `chroma_collection_name` | `r"E:\mimamori_artifacts\chroma"` / `"mimamori_companion_knowledge"` (`hnsw:space="cosine"`) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L41-L42), [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py#L363-L370) |
| `Settings.rag_top_k` / `Settings.rag_min_similarity_score` | `3` / `0.25` (see operational flag below for `huggingface_e5`) | [config.py](file:///e:/mimamori/ai-service/app/core/config.py#L44-L45), [main.py](file:///e:/mimamori/ai-service/main.py#L34-L39) |
| `BasePrefixEmbedder.default_min_similarity_score` | `0.25` (`HashDevEmbedder`), overridden to `0.795` on `HuggingFaceE5Embedder` (`ChromaKnowledgeRetriever` defaults to `embedder.default_min_similarity_score` when `min_similarity_score=None`) | [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py#L125-L248), [retriever.py](file:///e:/mimamori/ai-service/app/rag/retriever.py#L344-L354) |
| `CompanionService.handle_chat` pipeline | `SafetyDetector.evaluate_input` -> `ChromaKnowledgeRetriever.retrieve` -> `INSUFFICIENT_EVIDENCE` gate -> `ModelProvider.generate` -> `SafetyDetector.validate_output` | [companion_service.py](file:///e:/mimamori/ai-service/app/services/companion_service.py#L129-L260) |
| `primary_model` (`model_config.yaml`) | `Qwen/Qwen3-4B-Instruct-2507` (`qwen3`, `Qwen3ForCausalLM`, `min_transformers_version="4.51.0"`, `rec="4.57.6"`, `enable_thinking=false`, 4-bit NF4 `float16`, `double_quant=true`) | [model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml#L10-L41) |
| `comparison_model` (`model_config.yaml`) | `Qwen/Qwen3.5-4B` (`qwen3_5`, `Qwen3_5ForConditionalGeneration`, `AutoProcessor`, `min_transformers_version="5.2.0"`, `enable_thinking=false`, `qlora_4bit_recommended=false`) | [model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml#L43-L81) |
| `fallback_llm` (`model_config.yaml`) | `groq` (`openai/gpt-oss-120b` -> `openai/gpt-oss-20b`, `api_key_env=GROQ_API_KEY`, `max_tokens=256`, `temperature=0.6`) | [model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml#L83-L95) |
| `embedding_model` (`model_config.yaml`) | `intfloat/multilingual-e5-base` (`XLMRobertaModel`, `768`d, `512` max_tokens, `"query: "` / `"passage: "`, fallback `intfloat/multilingual-e5-small`) | [model_config.yaml](file:///e:/mimamori/ai-training/configs/model_config.yaml#L97-L108) |
| `training_config.yaml` defaults | `seed=42`, T4 `sm_75` (`fp16=true`, `bf16=false`, `load_in_4bit=true`, `nf4`, `float16`), LoRA `r=16`, `lora_alpha=32`, `lora_dropout=0.05`, `bs=2`, `ga=8`, `seq=1024`, `paged_adamw_8bit`, OOM fallback (`bs=1`, `ga=16`, `seq=768`), Drive `/content/drive/MyDrive/mimamori_companion_ai`, `min_recommended_reviewed_examples=200` | [training_config.yaml](file:///e:/mimamori/ai-training/configs/training_config.yaml#L4-L99) |

> [!IMPORTANT]
> **Operational Configuration Flag (`main.py` vs `HuggingFaceE5Embedder`)**: [main.py](file:///e:/mimamori/ai-service/main.py#L38) passes `min_similarity_score=cfg.rag_min_similarity_score` explicitly to `ChromaKnowledgeRetriever(...)`, and `Settings.rag_min_similarity_score` defaults to `0.25` (for `hash_dev`). When switching `EMBEDDING_PROVIDER=huggingface_e5` in a local/staging `.env`, operators **must** also set `RAG_MIN_SIMILARITY_SCORE=0.795` (otherwise `0.25` overrides `HuggingFaceE5Embedder.default_min_similarity_score`).

---

## 3. Observed Local Hardware & Software Environment

### 3.1 Host Hardware (Directly Observed)
- **Operating System**: `Microsoft Windows 11 Home` (`10.0.26200`, 64-bit)
- **CPU**: `13th Gen Intel(R) Core(TM) i7-1360P` (`12` physical cores, `16` logical processors)
- **System RAM**: `16,849,256,448` bytes (`15.69 GB` usable, nominal `16 GB`)
- **GPU**: `Intel(R) Iris(R) Xe Graphics` (integrated graphics only — **no NVIDIA CUDA GPU**, `torch.cuda.is_available() == False`)

### 3.2 Python & Package Versions

| Environment | Interpreter | Observed Packages & Versions |
| :--- | :--- | :--- |
| **`ai-service` Runtime Venv** | `E:\mimamori_venv\companion_ai\Scripts\python.exe` (`Python 3.12.7`) | `torch 2.15.0+cpu`, `chromadb 1.5.9`, `sentence-transformers 6.3.0`, `transformers 5.23.0`, `huggingface-hub 2.4.0`, `fastapi 0.165.0`, `pydantic 2.14.4`, `pydantic-settings 2.16.3`, `httpx 0.28.1`, `psutil 7.2.2`, `uvicorn 0.54.0`, `python-dotenv 1.2.4`, `pyyaml 6.0.4`, `pytest 9.2.0` |
| **Host Python (`ai-training`)** | `py -3.12-64` (`Python 3.12.7`) | `torch 2.12.0`, `nbformat 5.10.4`, `pytest 7.4.4`, `pyyaml 6.0.1`, `pandas 2.2.2` (`datasets` not installed on host) |

*(Note: `torch==2.15.0+cpu`, `sentence-transformers==6.3.0`, `transformers==5.23.0`, and `psutil==7.2.2` were installed in `E:\mimamori_venv\companion_ai` for Phase G; [ai-service/requirements.txt](file:///e:/mimamori/ai-service/requirements.txt) was left untouched with optional packages commented.)*

---

## 4. Real `intfloat/multilingual-e5-base` Embedding & ChromaDB RAG Smoke Test (Section 3)

Executed via [smoke_test_rag.py](file:///e:/mimamori/ai-training/scripts/smoke_test_rag.py) with `E:\mimamori_venv\companion_ai\Scripts\python.exe`; outputs saved to [rag_smoke_test.json](file:///e:/mimamori/ai-training/outputs/rag_smoke_test.json) and [rag_smoke_test.csv](file:///e:/mimamori/ai-training/outputs/rag_smoke_test.csv).

### 4.1 Integrity, Persistence, Prefix & Filter Verification
- **Embedding Provenance**: `embedding_source: "huggingface_real_weights"`, `embedding_provider: "huggingface_e5"`, `embedding_model_name: "intfloat/multilingual-e5-base"`, `hash_dev_used: false`, `vector_dimension: 768`, `l2_normalized_verified: true`.
- **E5 Prefix Enforcement**: `passage_prefix_enforced: true` (`14/14` indexed docs prefixed with `"passage: "`); `query_prefix_enforced: true` (`35/35` queries prefixed with `"query: "`).
- **ChromaDB Persistence (`E:\mimamori_artifacts\chroma_smoke_g`, `mimamori_smoke_g_e5`, `hnsw:space: "cosine"`)**:
  - `indexed_count=14`, `raw_persisted_count=14`, `reopened_count=14` on a fresh `ChromaKnowledgeRetriever` / `PersistentClient` without re-indexing.
  - Pre-reopen vs post-reopen top-1 query matched identically (`emergency_guidance_01`, score `0.8978`).
- **Metadata Filtering**: `5/5` category queries passed strict isolation (`elderly_care`, `general_health`, `medication_safety`, `app_usage`, `emergency_guidance`) with `strict_cross_category_isolation_passed: true`.

### 4.2 35-Query Evaluation Breakdown Across All 7 Query Types

| Query Type (`5` queries each) | Above `0.795` Threshold | Empty Retrieval Count | Raw Top-1 Category Acc | Raw Top-1 Doc Acc | MRR@3 (Cat / Doc) | Raw Top-1 Score (Min / Mean / Max) | Mean Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | ---: |
| `1. diacritic_vi` | `5/5` | `0` | `1.0000` (`5/5`) | `1.0000` (`5/5`) | `1.0000` / `1.0000` | `0.9025` / `0.9071` / `0.9151` | `53.07` |
| `2. no_diacritic_vi` | `1/5` | `4` | `0.6000` (`3/5`) | `0.6000` (`3/5`) | `0.6667` / `0.6000` | `0.7566` / `0.7848` / `0.8196` | `56.44` |
| `3. paraphrased` | `5/5` | `0` | `1.0000` (`5/5`) | `1.0000` (`5/5`) | `1.0000` / `1.0000` | `0.8308` / `0.8584` / `0.8836` | `177.27` |
| `4. elderly_conversational` | `5/5` | `0` | `1.0000` (`5/5`) | `1.0000` (`5/5`) | `1.0000` / `1.0000` | `0.8259` / `0.8349` / `0.8411` | `88.10` |
| `5. medication_safety` | `5/5` | `0` | `1.0000` (`5/5`) | `1.0000` (`5/5`) | `1.0000` / `1.0000` | `0.8520` / `0.8750` / `0.8896` | `88.75` |
| `6. daily_companionship` | `5/5` | `0` | `1.0000` (`5/5`) | `1.0000` (`5/5`) | `1.0000` / `1.0000` | `0.7968` / `0.8345` / `0.8612` | `74.96` |
| `7. out_of_domain` | `0/5` | `5` (`100%` rejected) | `N/A` | `N/A` | `N/A` | `0.7449` / `0.7686` / `0.7889` | `61.03` |

- **Aggregate In-Domain (`30` queries, incl. `no_diacritic_vi`)**: Raw Top-1 Category/Doc Accuracy `0.9333` (`28/30`), MRR@3 Category `0.9444`, MRR@3 Doc `0.9333`, Above-Threshold Rate `0.8667` (`26/30`), Score Range `0.7566–0.9151` (`mean 0.8491`).
- **Diacritic In-Domain (`25` queries, types 1, 3, 4, 5, 6)**: Raw Top-1 Category/Doc Accuracy **`1.0000` (`25/25`)**, Above-Threshold Rate **`1.0000` (`25/25`)**, Score Range `0.7968–0.9151` (`mean 0.8620`).
- **Out-of-Domain (`5` queries) & Empty Retrieval Behavior**:
  - All `5/5` OOD queries (`q31–q35`: World Cup, SJC gold price, Java `NullPointerException`, VN-Index stocks, motorbike spark plug) scored `0.7449–0.7889` (`mean 0.7686`), fell below `0.795`, returned `0` evidence items (`has_sufficient_evidence: false`, `empty_retrieval: true`), and emitted the deterministic Vietnamese `uncertainty_note`.
  - **Threshold Calibration Impact**: Because `intfloat/multilingual-e5-base` L2-normalized Vietnamese cosine similarities live in a high anisotropic band (`0.74–0.92`), the legacy `hash_dev` threshold (`0.25`) produced `0.0` (`0/5`) OOD empty retrieval vs `1.0` (`5/5`) at `0.795`. The clean separation margin between the minimum diacritic in-domain score (`q26`, `0.7968`) and maximum OOD score (`q35`, `0.7889`) is narrow (**`0.0079`**), while `mean_gap_diacritic_in_domain_vs_ood = 0.0934` (`0.0805` across all 30 in-domain queries).
  - **No-Diacritic Limitation**: Stripped-diacritic Vietnamese queries (`q06–q10`) dropped to `mean 0.7848`, with `4/5` (`q07`, `q08`, `q09`, `q10`) falling below `0.795` and `2/5` (`q07`, `q09`) missing top-1 category/doc even before thresholding.
- **Process RAM & Query Latency (Real CPU Execution)**:
  - **Memory**: `rss_before_load_mb = 410.15 MB`, `rss_after_load_and_index_mb = 1860.29 MB` (**`+1450.14 MB`** model + index delta), `peak_rss_mb = 1861.95 MB` (fits comfortably inside `15.69 GB` host RAM).
  - **Timing**: Indexing `14` documents `10,411.67 ms`; query latency `mean = 85.66 ms`, `p50 = 68.73 ms`, `p95 = 174.30 ms`, `min = 50.02 ms`, `max = 332.87 ms`.

---

## 5. Qwen3-4B-Instruct-2507 & Qwen3.5-4B Colab Smoke-Test Readiness (Section 4)

### 5.1 Notebook Readiness & Validation ([03_baseline_evaluation.ipynb](file:///e:/mimamori/ai-training/notebooks/03_baseline_evaluation.ipynb))
Preserved **Part A (Steps 1–5)** intact and added **Part B (Phase G, Steps B1–B7)** for controlled real GPU inference verification on Google Colab Free T4:
- **Step B1 (Free-Tier GPU Guard)**: Runs `nvidia-smi`, `torch.cuda.get_device_properties(0)`, `torch.cuda.mem_get_info(0)`, and CUDA version check; aborts immediately without weight download or billing if CUDA is missing, `ENFORCE_FREE_T4_ONLY=True` detects a non-T4/paid GPU, or free VRAM is `< 6.0 GB`.
- **Step B2 (Dependency Gate)**: Verifies `transformers >= 4.51.0` (`Qwen3`), `transformers >= 5.2.0` (`Qwen3.5`), `peft`, `accelerate`, and `bitsandbytes`.
- **Step B3 (4-bit NF4 Non-Thinking Load)**: Loads `AutoTokenizer` + `Qwen/Qwen3-4B-Instruct-2507` with `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)`, asserts `enable_thinking=False` suppresses `<think>`, and sets `model.eval()` (no training, no mocks).
- **Steps B4–B6 (5 Vietnamese Prompts, Latency, Peak VRAM, Drive Artifacts)**: Runs deterministic (`do_sample=False`, `max_new_tokens=256`) inference on 5 exact prompts (`daily_companionship`, `emotional_support`, `medication_safety`, `insufficient_information`, `emergency_symptoms`), measures per-prompt/mean latency (`ms`/`s`, `tok/s`) and `torch.cuda.max_memory_allocated` / `max_memory_reserved` (MB), and saves `/content/drive/MyDrive/mimamori_companion_ai/eval_outputs/qwen_smoke_test_outputs.json` & `.md`.
- **Step B7 (`Qwen/Qwen3.5-4B` Lightweight Compatibility Check)**: Checks `transformers >= 5.2.0`, `AutoConfig`, and `chat_template(enable_thinking=False)` without downloading 4B weights or running full evaluation.
- **Notebook Validation Output (`py -3.12-64` `nbformat.validate` + `ast.parse`)**:
  `VALIDATED: total_cells=26, code_cells=12, md_cells=14, nbformat=4.5`

### 5.2 Honest Local GPU Execution Status
- **`Qwen/Qwen3-4B-Instruct-2507` Real Inference**: **`NOT_TESTED` locally** (Windows host has no NVIDIA CUDA GPU; `cuda_available=False`; GPU VRAM `N/A locally`; zero 4B weights downloaded; zero Colab/paid compute triggered).
- **`Qwen/Qwen3.5-4B` Live Config/Tokenizer Check**: **`NOT_TESTED` locally** (deferred to Colab notebook Step B7).

---

## 6. Expanded Deterministic Safety Test Results (Section 5)

Diagnostic suite implemented in [smoke_test_safety_and_provider.py](file:///e:/mimamori/ai-service/scripts/smoke_test_safety_and_provider.py) and [test_safety_smoke_expanded.py](file:///e:/mimamori/ai-service/tests/test_safety_smoke_expanded.py), with pre/post comparison recorded in [safety_smoke_test.json](file:///e:/mimamori/ai-training/outputs/safety_smoke_test.json).

### 6.1 Before vs After Refinement Summary (`54` Cases, `10` Classes)

| Scenario Class | Cases | Before Passed | Before FP | Before FN | Before Risk Mismatch | After Passed | After FP | After FN | After Risk Mismatch |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `1_current_affirmative` | `6` | `6/6` | `0` | `0` | `0` | `6/6` | `0` | `0` | `0` |
| `2_explicit_negation` | `5` | `3/5` | `2` | `0` | `0` | `5/5` | `0` | `0` | `0` |
| `3_historical_symptoms` | `5` | `1/5` | `4` | `0` | `0` | `5/5` | `0` | `0` | `0` |
| `4_hypothetical_symptoms` | `5` | `0/5` | `5` | `0` | `0` | `5/5` | `0` | `0` | `0` |
| `5_uncertain_symptoms` | `5` | `4/5` | `0` | `0` | `1` (`C05_05`) | `5/5` | `0` | `0` | `0` |
| `6_no_diacritics` | `5` | `4/5` | `1` | `0` | `0` | `5/5` | `0` | `0` | `0` |
| `7_stt_errors` | `7` | `3/7` | `0` | `4` | `0` | `7/7` | `0` | `0` | `0` |
| `8_multiple_symptoms` | `5` | `3/5` | `0` | `2` | `0` | `5/5` | `0` | `0` | `0` |
| `9_medication_dosage` | `6` | `1/6` | `1` | `4` | `0` | `6/6` | `0` | `0` | `0` |
| `10_diagnosis_requests` | `5` | `2/5` | `0` | `3` | `0` | `5/5` | `0` | `0` | `0` |
| **Total** | **`54`** | **`27/54`** | **`13`** | **`13`** | **`1`** | **`54/54`** | **`0`** | **`0`** | **`0`** |

### 6.2 Refinements Applied ([policies.py](file:///e:/mimamori/ai-service/app/safety/policies.py) & [detector.py](file:///e:/mimamori/ai-service/app/safety/detector.py))
- **Negation Window & Multi-Clause Reset**: Switched `_is_negated_or_preventive` to match the rightmost negation marker within a 7-token window (handling unpunctuated repeated negation like `"hom nay toi khong dau nguc khong kho tho gi ca"`), added affirmative contrast resets (`dang`, `lai`, `nhung`), and expanded `_NEGATION_LINKER_PHRASES` (`"cam thay"`, `"dau"`, `"bi dau"`, `"khong phai"`).
- **Historical & Hypothetical Context Guards with Active Override**: Added `_is_historical_clause` (`tuan truoc`, `nam ngoai`, `thang truoc`, `hoi truoc`, `cach day ... tuan/thang/nam`) and `_is_hypothetical_clause` (`gia su`, `vi du`, `neu lo`, `lo nhu`, `truong hop ... can lam gi`), strictly bypassed whenever `ACTIVE_CURRENT_OVERRIDE_MARKERS` (`dang`, `hom nay`, `lai dau`, `vua moi`, etc.) appear in the clause so relapse alerts (`C03_05`) still trigger `115` immediately.
- **Vietnamese STT Variants & Multi-Symptom Pairs**: Added common STT misrecognitions (`dau ngut`, `ngat siu`, `chong mac`, `choang mat`, `dot qui`) and missing `MULTI_SYMPTOM_CRITICAL_PAIRS` (`{"dizziness", "palpitations"}`, `{"numbness_weakness", "vision_change"}`).
- **Dosage & Diagnosis Guardrail Precision**: Added regex patterns for natural dosage requests (`bo bot nua vien`, `ke giup ong thuoc`, `ngung uong thuoc`, `uong them 1 vien`), accent-sensitive `ACCENTED_STOP_MEDICATION_PATTERN` (`dừng thuốc` triggers while `dùng thuốc` does not), natural diagnosis phrasing (`co phai ... tieu duong`, `mac chung gi`), and `_CLINICIAN_DIAGNOSIS_REPORT_RE` so reporting an existing doctor diagnosis is not falsely blocked.
- **Adversarial Priority Verified**: All 8 adversarial/mixed edge cases in `test_emergency_priority_and_adversarial_edge_cases_never_weakened` trigger `115` `emergency_protocol` regardless of historical first clauses, negation of other symptoms, or embedded diagnosis/dosage asks.

### 6.3 Honest Safety Limitations
- Deterministic rule-based checks and these `54` synthetic cases are **engineering guardrails only**; they do **NOT** constitute medical or clinical validation.
- Unseen regional Vietnamese dialects, severe STT word corruption outside covered variants, sarcasm/irony, or multi-clause clinical ambiguity can still produce errors and require human/clinical oversight.

---

## 7. Real `OpenAICompatibleProvider` Groq Smoke Test (Section 6)

Executed via [smoke_test_safety_and_provider.py](file:///e:/mimamori/ai-service/scripts/smoke_test_safety_and_provider.py) against `https://api.groq.com/openai/v1` with `model="openai/gpt-oss-120b"` and `max_tokens=200` (`GROQ_API_KEY` read strictly in-memory from `e:\mimamori\.env`); sanitized output saved to [provider_smoke_test.json](file:///e:/mimamori/ai-training/outputs/provider_smoke_test.json).

### 7.1 Compatibility Issue Caught & Fixed
During initial smoke execution, `OpenAICompatibleProvider` hit empty/truncated output at `max_tokens=200` (`P05_hydration` returned empty `message.content`; `P01_greeting` truncated at 16 chars) because Groq's `openai/gpt-oss-120b` spent the short token budget on internal `reasoning_tokens`, and `str(None)` risked literal `"None"`. Updated [provider.py](file:///e:/mimamori/ai-service/app/models/provider.py#L205-L227) to send `reasoning_effort="low"` when calling Groq `gpt-oss` models and guard `raw_content is None`.

### 7.2 Sanitized Live Groq Smoke Results (`TESTED_SUCCESSFULLY`)

| Check ID | Path / Mode | Status | HTTP | Provider / Boundary | Latency (ms) | Reply Length |
| :--- | :--- | :--- | :---: | :--- | ---: | :---: |
| `P01_greeting` | Direct `OpenAICompatibleProvider` | `TESTED_SUCCESSFULLY` | `200` | `openai/gpt-oss-120b` | `978.67` | `115` chars |
| `P02_sleep` | Direct `OpenAICompatibleProvider` | `TESTED_SUCCESSFULLY` | `200` | `openai/gpt-oss-120b` | `1339.40` | `160` chars |
| `P03_med_habit` | Direct `OpenAICompatibleProvider` | `TESTED_SUCCESSFULLY` | `200` | `openai/gpt-oss-120b` | `1269.34` | `154` chars |
| `P04_companionship` | Direct `OpenAICompatibleProvider` | `TESTED_SUCCESSFULLY` | `200` | `openai/gpt-oss-120b` | `1244.51` | `127` chars |
| `P05_hydration` | Direct `OpenAICompatibleProvider` | `TESTED_SUCCESSFULLY` | `200` | `openai/gpt-oss-120b` | `1303.22` | `212` chars |
| `SVC_non_emergency` | `CompanionService` (non-emergency) | `TESTED_SUCCESSFULLY` | `200` | `openai_compatible` / `retrieved_evidence` (`1` doc) | `1582.53` | `>= 150` chars |
| `SVC_emergency_bypass` | `CompanionService` (chest pain + dyspnea) | `TESTED_SUCCESSFULLY` | `null` | `deterministic_safety_gate` / `emergency_protocol` (`115`, bypassed Groq) | `10.03` | deterministic |

---

## 8. Independent Post-Edit Test Re-Run Results

All test suites were re-executed independently after all Phase G edits:
- **`ai-service` pytest**: `Set-Location e:\mimamori\ai-service; E:\mimamori_venv\companion_ai\Scripts\python.exe -m pytest -v` -> **`110 passed in 8.17s`** (`45` pre-existing + `65` new tests in [test_safety_smoke_expanded.py](file:///e:/mimamori/ai-service/tests/test_safety_smoke_expanded.py)).
- **`ai-training` pytest**: `py -3.12-64 -m pytest e:\mimamori\ai-training\tests\test_dataset_and_eval.py -v` -> **`11 passed in 0.28s`**.
- **Notebook Validation**: `py -3.12-64` `nbformat.validate` + `ast.parse` on [03_baseline_evaluation.ipynb](file:///e:/mimamori/ai-training/notebooks/03_baseline_evaluation.ipynb) -> `VALIDATED: total_cells=26, code_cells=12, md_cells=14, nbformat=4.5`.

---

## 9. Errors, Risks & Compatibility Problems Observed

1. **E5 Cosine Similarity Band vs `hash_dev` Threshold (`0.25`)**: Real `intfloat/multilingual-e5-base` Vietnamese similarities sit in `0.74–0.92`, so `0.25` failed to reject any OOD queries (`0/5`). Calibrating `HuggingFaceE5Embedder.default_min_similarity_score = 0.795` rejected `5/5` OOD queries, though [main.py](file:///e:/mimamori/ai-service/main.py#L38) passes `Settings.rag_min_similarity_score` (`0.25`) explicitly—meaning `.env` deployments with `EMBEDDING_PROVIDER=huggingface_e5` must set `RAG_MIN_SIMILARITY_SCORE=0.795`.
2. **Narrow In-Domain/OOD Margin & Stripped-Diacritic Drop on E5**: Clean margin between minimum diacritic in-domain (`0.7968`) and maximum OOD (`0.7889`) is only `0.0079`, and `no_diacritic_vi` scored `0.7848` mean (`4/5` rejected by `0.795`, `0.60` raw top-1 accuracy).
3. **Groq `openai/gpt-oss-120b` Reasoning Budget Truncation**: Default Chat Completions payload without `reasoning_effort="low"` exhausted `max_tokens=200` on internal `reasoning_tokens` and returned empty/`None` `message.content`. Fixed in [provider.py](file:///e:/mimamori/ai-service/app/models/provider.py#L207-L225).
4. **Baseline Safety Rule Gaps**: Initial `SafetyDetector` scored `27/54` (`13` FP, `13` FN, `1` risk mismatch) on historical, hypothetical, nested-negation, STT, multi-symptom, dosage, and diagnosis queries before Phase G refinements brought the suite to `54/54`.
5. **Host vs Venv Package Split**: Host `py -3.12-64` lacks `datasets`, while `E:\mimamori_venv\companion_ai` holds the real CPU embedding stack (`torch 2.15.0+cpu`, `sentence-transformers 6.3.0`, `psutil 7.2.2`) commented as optional in [ai-service/requirements.txt](file:///e:/mimamori/ai-service/requirements.txt).

---

## 10. Explicit `NOT_TESTED` Items List

- **`Qwen/Qwen3-4B-Instruct-2507` Real 4-bit NF4 Inference & VRAM/Latency on Colab Free T4** (`VRAM N/A locally`, zero 4B weights downloaded locally, zero paid compute triggered).
- **`Qwen/Qwen3.5-4B` Live `AutoConfig` & `chat_template` Verification on Colab** (`transformers >= 5.2.0` Step B7 in `03_baseline_evaluation.ipynb`).
- **Full 20-Case Baseline Evaluation (`eval_benchmark.jsonl`) on Colab Free T4** (`03_baseline_evaluation.ipynb` Part A).
- **QLoRA SFT Training (`04_lora_training.ipynb`) and Base vs LoRA vs Groq Comparison (`05_model_comparison.ipynb`)**.
- **`TransformersLocalAdapterProvider` Real Local LoRA Adapter Inference** (`LORA_ADAPTER_PATH` unset).
- **Live HTTP `uvicorn` Server with `EMBEDDING_PROVIDER=huggingface_e5` + `MODEL_PROVIDER=openai_compatible` and Spring Boot `backend/` -> `ai-service/` End-to-End Integration** (including mobile STT/TTS round-trip).
- **Clinical & Geriatric SME Review** of `synthetic_companion_seed.jsonl` (`32` rows, `reviewed=false`), `eval_benchmark.jsonl` (`20` rows, `reviewed=false`), and `ai-service/app/rag/knowledge/*.json` (`sample_educational_pending_review`).

---

## 11. Next-Phase Recommendations & Mandatory User Approval Gate

1. **Run `03_baseline_evaluation.ipynb` Part B (Steps B1–B7) on Google Colab Free T4 first** (with `ENFORCE_FREE_T4_ONLY=True`) to record real 5-prompt `Qwen/Qwen3-4B-Instruct-2507` latency, peak VRAM, and `Qwen/Qwen3.5-4B` metadata check before touching full evaluation.
2. **Fix `main.py` / `.env` Threshold Alignment & Add Accentless RAG Fallback**: Update `main.py` (when authorized) so `RAG_MIN_SIMILARITY_SCORE` defaults cleanly per `embedding_provider` (`0.25` for `hash_dev`, `0.795` for `huggingface_e5`) and evaluate a lightweight hybrid lexical/BM25 or diacritic-restoration step to recover `no_diacritic_vi` accuracy and widen the `0.0079` E5 margin.
3. **Complete Clinical/Geriatric Review Gate**: Expand and clinically review training dialogues to `>= 200` approved examples (`min_recommended_reviewed_examples: 200`) and review `ai-service/app/rag/knowledge/*.json` before any production LoRA training.

> [!CAUTION]
> **STOP — AWAITING USER AUTHORIZATION**: Do **NOT** launch full 20-case Colab baseline evaluation, QLoRA fine-tuning (`04_lora_training.ipynb`), model comparison (`05_model_comparison.ipynb`), or modifications to `backend/`, `app/`, `docker/`, or `.env` without explicit user approval after reviewing this report.
