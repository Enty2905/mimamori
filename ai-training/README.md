# Mimamori Companion AI — Training, Dataset & Evaluation (`ai-training/`)

Offline dataset curation, quality validation, Google Colab Free T4 (15GB VRAM) QLoRA configuration, and multi-model evaluation harness for the Vietnamese elderly companion AI (`Mimamori AI`).

> **Scope Isolation**: This workspace is intentionally decoupled from `backend/`, `app/`, `ai/`, `docker/`, and `ai-service/`. Never commit downloaded model weights, adapter binaries, or API keys.

---

## 1. Directory Structure

```text
ai-training/
├── configs/
│   ├── model_config.yaml         # Primary Qwen3, comparison Qwen3.5, Groq fallback, E5 embedding spec
│   └── training_config.yaml      # Colab T4 4-bit QLoRA NF4 fp16 hyperparameters & OOM fallback profile
├── datasets/
│   ├── raw/
│   │   └── synthetic_companion_seed.jsonl   # 32 synthetic Vietnamese seed dialogues (reviewed=false)
│   ├── processed/
│   │   ├── train.jsonl           # 16 stratified train dialogues
│   │   ├── val.jsonl             # 8 stratified validation dialogues
│   │   └── test.jsonl            # 8 stratified test dialogues
│   └── evaluation/
│       └── eval_benchmark.jsonl  # 20 held-out eval cases (0 overlap with train/val/test)
├── notebooks/                    # Google Colab notebooks (01..05)
├── outputs/                      # Quality reports (.json/.md) and evaluation artifacts (.json/.csv)
├── scripts/
│   ├── prepare_dataset.py        # Stratified split + eval overlap exclusion + validation
│   ├── validate_dataset.py       # Schema, roles, PII, safety claims & split leakage validator
│   └── evaluate_model.py         # Deterministic 9-metric evaluator & status tracker
└── tests/
    └── test_dataset_and_eval.py  # Unit tests (unittest & pytest compatible)
```

---

## 2. Model Strategy & Hardware Constraints

- **Primary Fine-Tuning Model**: `Qwen/Qwen3-4B-Instruct-2507`
  - Architecture: `Qwen3ForCausalLM` (`model_type: qwen3`), `transformers >= 4.51.0`
  - Thinking behavior: **Non-thinking only** (`enable_thinking: false`, no `<think>` output tags)
  - LoRA target modules: `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`
  - Colab Free T4 (15GB VRAM, `sm_75`): 4-bit NF4 QLoRA (`bnb_4bit_compute_dtype: float16`, `fp16: true`, `bf16: false`, `optim: paged_adamw_8bit`, `gradient_checkpointing: true`) fits safely within ~6.5–9.5 GB VRAM.
  - OOM safe fallback profile in `configs/training_config.yaml`: `batch_size: 1`, `gradient_accumulation_steps: 16`, `max_seq_length: 768`.
- **Comparison Model**: `Qwen/Qwen3.5-4B`
  - Architecture: `Qwen3_5ForConditionalGeneration` (`model_type: qwen3_5`), `transformers >= 5.2.0`
  - Thinking behavior: Thinking ON by default; must explicitly pass `enable_thinking: false` during SFT/eval.
  - Compatibility warning: Hybrid 3:1 GatedDeltaNet `linear_attn` + `full_attention` + vision blocks. 4-bit QLoRA carries quantization divergence risk on `linear_attn` / `conv1d`, and `fp16` LoRA carries `NaN` / memory pressure on T4.
- **Fallback Cloud LLM**: `groq` (`openai/gpt-oss-120b` -> `openai/gpt-oss-20b`), configured strictly via `GROQ_API_KEY` environment variable (no hardcoded keys).
- **RAG Embedding Alignment**: `intfloat/multilingual-e5-base` (`query: ` / `passage: ` prefixes) aligned with `ai-service/`.

---

## 3. Data Provenance & Safety Gate

- `datasets/raw/synthetic_companion_seed.jsonl` (`source: synthetic_mimamori_seed_v1`, 32 dialogues) and `datasets/evaluation/eval_benchmark.jsonl` (`source: synthetic_eval_benchmark_v1`, 20 cases) are **synthetic v1 seed datasets** with `reviewed: false`.
- **Pre-production gate**: Do not treat synthetic seed training runs as clinically approved. Human geriatric/medical review (`reviewed: true`) and dataset expansion are required before production fine-tuning.
- All records contain **zero PII** (checked for Vietnamese phone numbers, CCCD/CMND numbers, emails, and leaked tokens) and enforce strict medical safety rules (no invented dosages, no diagnosis, immediate `115` + family guidance on emergencies).

---

## 4. Running Scripts & Tests Locally (Windows `py -3.12-64`)

```powershell
# 1. Generate stratified train/val/test splits and validate
py -3.12-64 e:\mimamori\ai-training\scripts\prepare_dataset.py

# 2. Validate raw, processed splits, and held-out benchmark
py -3.12-64 e:\mimamori\ai-training\scripts\validate_dataset.py --require-processed

# 3. Run deterministic pipeline verification in mock mode (never invents real model scores)
py -3.12-64 e:\mimamori\ai-training\scripts\evaluate_model.py --mock

# 4. Optional: evaluate live Groq fallback (requires GROQ_API_KEY in environment)
# $env:GROQ_API_KEY="..."; py -3.12-64 e:\mimamori\ai-training\scripts\evaluate_model.py --targets groq_fallback

# 5. Run unit tests
py -3.12-64 -m unittest discover -s e:\mimamori\ai-training\tests -v
py -3.12-64 -m pytest e:\mimamori\ai-training\tests\test_dataset_and_eval.py -v
```
