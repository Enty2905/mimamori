# Mimamori Companion AI — Dataset Quality Report

- **Generated (UTC)**: `2026-11-21T04:14:58.582903+00:00`
- **Overall Status**: `PASSED`
- **Total Errors**: `0`
- **Total Warnings**: `5`
- **Zero Split/Benchmark Leakage**: `True`

## 1. Dataset Inventory & Turn Statistics

| Dataset | Records | Single-Turn | Multi-Turn | Unreviewed (`reviewed=false`) | PII Hits | Safety Issues |
|---|---:|---:|---:|---:|---:|---:|
| `raw_seed` | 32 | 20 | 12 | 32 | 0 | 0 |
| `eval_benchmark` | 20 | 14 | 6 | 20 | 0 | 0 |
| `train` | 16 | 6 | 10 | 16 | 0 | 0 |
| `val` | 8 | 7 | 1 | 8 | 0 | 0 |
| `test` | 8 | 7 | 1 | 8 | 0 | 0 |

## 2. Category Coverage (8 Required Categories)

| Category | `raw_seed` | `eval_benchmark` | `train` | `val` | `test` |
|---|---:|---:|---:|---:|---:|
| `daily_conversation` | 4 | 2 | 2 | 1 | 1 |
| `emotional_support` | 4 | 3 | 2 | 1 | 1 |
| `elderly_companionship` | 4 | 2 | 2 | 1 | 1 |
| `daily_routines` | 4 | 2 | 2 | 1 | 1 |
| `medication_assistance` | 4 | 3 | 2 | 1 | 1 |
| `basic_health_information` | 4 | 2 | 2 | 1 | 1 |
| `emergency_situations` | 4 | 4 | 2 | 1 | 1 |
| `unclear_or_insufficient_information` | 4 | 2 | 2 | 1 | 1 |

## 3. Safety Level Distribution

| Safety Level | `raw_seed` | `eval_benchmark` | `train` | `val` | `test` |
|---|---:|---:|---:|---:|---:|
| `low` | 16 | 8 | 9 | 3 | 4 |
| `medium` | 8 | 5 | 4 | 2 | 2 |
| `high` | 5 | 4 | 1 | 3 | 1 |
| `critical` | 3 | 3 | 2 | 0 | 1 |

## 4. Split & Eval Benchmark Leakage Checks

- `train__vs__val`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0
- `train__vs__test`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0
- `val__vs__test`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0
- `train__vs__eval_benchmark`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0
- `val__vs__eval_benchmark`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0
- `test__vs__eval_benchmark`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0
- `raw_seed__vs__eval_benchmark`: id_overlap=0, conversation_overlap=0, user_turn_overlap=0

## 5. Warnings & Review Gates

- raw_seed: 32/32 records have reviewed=false (allowed for synthetic seed/smoke tests; requires clinical/geriatric review before prod SFT).
- eval_benchmark: 20/20 eval prompts have reviewed=false.
- train: 16/16 records have reviewed=false (allowed for synthetic seed/smoke tests; requires clinical/geriatric review before prod SFT).
- val: 8/8 records have reviewed=false (allowed for synthetic seed/smoke tests; requires clinical/geriatric review before prod SFT).
- test: 8/8 records have reviewed=false (allowed for synthetic seed/smoke tests; requires clinical/geriatric review before prod SFT).
