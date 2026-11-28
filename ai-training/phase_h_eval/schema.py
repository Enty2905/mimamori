"""Schema validation and strict I/O loaders for Phase H evaluation benchmarks and predictions."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import jsonschema
    from jsonschema import Draft202012Validator
except ImportError:  # pragma: no cover - fallback when jsonschema is unavailable
    jsonschema = None
    Draft202012Validator = None

PACKAGE_DIR = Path(__file__).resolve().parent
AI_TRAINING_ROOT = PACKAGE_DIR.parent
DEFAULT_SCHEMA_PATH = AI_TRAINING_ROOT / "configs" / "phase_h_dataset_schema.json"
DEFAULT_BENCHMARK_PATH = (
    AI_TRAINING_ROOT / "datasets" / "evaluation" / "phase_h_eval_benchmark_80.jsonl"
)

ALLOWED_CATEGORIES: tuple[str, ...] = (
    "daily_companionship",
    "emotional_support",
    "medication_safety",
    "insufficient_or_ambiguous_information",
    "emergency_symptoms",
    "privacy_and_personal_information",
    "out_of_scope_medical_questions",
    "general_app_assistance_and_rag",
)

CATEGORY_TO_PREFIX: dict[str, str] = {
    "daily_companionship": "dc",
    "emotional_support": "es",
    "medication_safety": "ms",
    "insufficient_or_ambiguous_information": "ia",
    "emergency_symptoms": "em",
    "privacy_and_personal_information": "pr",
    "out_of_scope_medical_questions": "om",
    "general_app_assistance_and_rag": "ga",
}

EXPECTED_FULL_CATEGORY_COUNTS: dict[str, int] = {
    "daily_companionship": 10,
    "emotional_support": 10,
    "medication_safety": 15,
    "insufficient_or_ambiguous_information": 10,
    "emergency_symptoms": 15,
    "privacy_and_personal_information": 5,
    "out_of_scope_medical_questions": 5,
    "general_app_assistance_and_rag": 10,
}

ALLOWED_SEVERITIES: tuple[str, ...] = ("low", "medium", "high", "critical")

ALLOWED_EXPECTED_OUTCOMES: tuple[str, ...] = (
    "helpful_companion_response",
    "safe_refusal_and_redirect",
    "clarification_and_safe_redirect",
    "backend_context_dependent_guidance",
    "immediate_emergency_115_escalation",
    "privacy_refusal_and_boundary",
    "rag_grounded_guidance",
)

REQUIRED_BENCHMARK_FIELDS: tuple[str, ...] = (
    "id",
    "category",
    "prompt",
    "expected_behavior",
    "prohibited_behaviors",
    "evaluation_criteria",
    "severity",
    "safety_layer_expected",
    "backend_retrieval_required",
    "expected_outcome",
)

RECORD_ID_RE = re.compile(r"^ph-(dc|es|ms|ia|em|pr|om|ga)-[0-9]{3}$")


class BenchmarkValidationError(ValueError):
    """Raised when the Phase H evaluation benchmark fails strict validation."""

    def __init__(self, message: str, errors: list[str] | None = None) -> None:
        self.errors: list[str] = list(errors or [])
        detail = message
        if self.errors:
            preview = "\n  - ".join(self.errors[:15])
            suffix = (
                f"\n  ... (+{len(self.errors) - 15} more errors)"
                if len(self.errors) > 15
                else ""
            )
            detail = f"{message} ({len(self.errors)} errors):\n  - {preview}{suffix}"
        super().__init__(detail)


class PredictionValidationError(ValueError):
    """Raised when model prediction records are missing, malformed, or misaligned."""

    def __init__(self, message: str, errors: list[str] | None = None) -> None:
        self.errors: list[str] = list(errors or [])
        detail = message
        if self.errors:
            preview = "\n  - ".join(self.errors[:15])
            suffix = (
                f"\n  ... (+{len(self.errors) - 15} more errors)"
                if len(self.errors) > 15
                else ""
            )
            detail = f"{message} ({len(self.errors)} errors):\n  - {preview}{suffix}"
        super().__init__(detail)


@dataclass(frozen=True)
class BenchmarkRecord:
    """Validated Phase H evaluation benchmark record matching phase_h_dataset_schema.json."""

    id: str
    category: str
    prompt: str
    expected_behavior: str
    prohibited_behaviors: tuple[str, ...]
    evaluation_criteria: tuple[str, ...]
    severity: str
    safety_layer_expected: bool
    backend_retrieval_required: bool
    expected_outcome: str

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BenchmarkRecord":
        return cls(
            id=str(data["id"]),
            category=str(data["category"]),
            prompt=str(data["prompt"]),
            expected_behavior=str(data["expected_behavior"]),
            prohibited_behaviors=tuple(str(x) for x in data["prohibited_behaviors"]),
            evaluation_criteria=tuple(str(x) for x in data["evaluation_criteria"]),
            severity=str(data["severity"]),
            safety_layer_expected=bool(data["safety_layer_expected"]),
            backend_retrieval_required=bool(data["backend_retrieval_required"]),
            expected_outcome=str(data["expected_outcome"]),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category,
            "prompt": self.prompt,
            "expected_behavior": self.expected_behavior,
            "prohibited_behaviors": list(self.prohibited_behaviors),
            "evaluation_criteria": list(self.evaluation_criteria),
            "severity": self.severity,
            "safety_layer_expected": self.safety_layer_expected,
            "backend_retrieval_required": self.backend_retrieval_required,
            "expected_outcome": self.expected_outcome,
        }


@dataclass(frozen=True)
class PredictionRecord:
    """Validated model or pipeline prediction record for a single benchmark case."""

    id: str
    response: str
    latency_ms: float | None = None
    output_tokens: int | None = None
    input_tokens: int | None = None
    tokens_per_sec: float | None = None
    peak_vram_allocated_mb: float | None = None
    peak_vram_reserved_mb: float | None = None
    mode: str | None = None
    safety_triggered: bool | None = None
    pipeline_stage: str | None = None
    guardrail_flags: tuple[str, ...] = field(default_factory=tuple)
    provider: str | None = None
    knowledge_boundary: str | None = None
    evidence_sources: tuple[dict[str, Any], ...] = field(default_factory=tuple)
    personal_context: dict[str, Any] | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "response": self.response,
            "latency_ms": self.latency_ms,
            "output_tokens": self.output_tokens,
            "input_tokens": self.input_tokens,
            "tokens_per_sec": self.tokens_per_sec,
            "peak_vram_allocated_mb": self.peak_vram_allocated_mb,
            "peak_vram_reserved_mb": self.peak_vram_reserved_mb,
            "mode": self.mode,
            "safety_triggered": self.safety_triggered,
            "pipeline_stage": self.pipeline_stage,
            "guardrail_flags": list(self.guardrail_flags),
            "provider": self.provider,
            "knowledge_boundary": self.knowledge_boundary,
            "evidence_sources": list(self.evidence_sources),
            "personal_context": self.personal_context,
            "extra": dict(self.extra),
        }


def compute_file_sha256(path: Path) -> str:
    """Compute SHA-256 hex digest for reproducibility metadata."""
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_schema(schema_path: Path = DEFAULT_SCHEMA_PATH) -> dict[str, Any]:
    """Load the Phase H JSON Schema file."""
    if not schema_path.exists():
        raise BenchmarkValidationError(f"Schema file not found: {schema_path}")
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise BenchmarkValidationError(f"Invalid JSON in schema file {schema_path}: {exc}") from exc
    if not isinstance(schema, dict):
        raise BenchmarkValidationError(f"Schema root must be a JSON object: {schema_path}")
    return schema


def _parse_jsonl_objects(path: Path, error_cls: type[ValueError]) -> list[dict[str, Any]]:
    if not path.exists():
        raise error_cls(f"File not found: {path}")
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_no, raw_line in enumerate(handle, start=1):
            stripped = raw_line.strip()
            if not stripped:
                errors.append(f"{path.name}:{line_no}: empty blank line in JSONL")
                continue
            try:
                obj = json.loads(stripped)
            except json.JSONDecodeError as exc:
                errors.append(f"{path.name}:{line_no}: invalid JSON ({exc})")
                continue
            if not isinstance(obj, dict):
                errors.append(f"{path.name}:{line_no}: line must be a JSON object")
                continue
            records.append(obj)
    if errors:
        raise error_cls(f"Failed to parse JSONL file {path}", errors)
    return records


def _is_valid_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate_benchmark_records(
    raw_records: list[dict[str, Any]],
    schema: dict[str, Any] | None = None,
    *,
    require_full_80: bool = False,
) -> list[BenchmarkRecord]:
    """Strictly validate Phase H benchmark records using Draft202012Validator + semantic checks."""
    if not isinstance(raw_records, list) or not raw_records:
        raise BenchmarkValidationError("Benchmark dataset is empty or not a list of records.")

    validator = None
    if schema is not None and Draft202012Validator is not None:
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)

    errors: list[str] = []
    seen_ids: set[str] = set()
    category_counts: Counter[str] = Counter()
    validated: list[BenchmarkRecord] = []

    for idx, rec in enumerate(raw_records, start=1):
        if not isinstance(rec, dict):
            errors.append(f"record[{idx}]: must be a JSON object")
            continue

        rec_id = rec.get("id", f"<missing-id-{idx}>")
        ctx = f"record[{idx}]({rec_id})"

        # 1) JSON Schema Draft 2020-12 validation
        if validator is not None:
            for err in sorted(validator.iter_errors(rec), key=lambda e: list(e.path)):
                loc = ".".join(str(p) for p in err.path) or "<root>"
                errors.append(f"{ctx} [jsonschema:{loc}]: {err.message}")

        # 2) Explicit defense-in-depth strict checks (also catches whitespace-only strings & prefix mismatch)
        missing_fields = [f for f in REQUIRED_BENCHMARK_FIELDS if f not in rec]
        if missing_fields:
            errors.append(f"{ctx}: missing required fields: {missing_fields}")
            continue

        extra_fields = sorted(set(rec.keys()) - set(REQUIRED_BENCHMARK_FIELDS))
        if extra_fields:
            errors.append(f"{ctx}: unexpected extra fields: {extra_fields}")

        # ID check + duplicate check
        id_val = rec["id"]
        if not isinstance(id_val, str) or not id_val.strip():
            errors.append(f"{ctx}: 'id' must be a non-empty string")
            id_match = None
        else:
            id_match = RECORD_ID_RE.match(id_val)
            if not id_match:
                errors.append(
                    f"{ctx}: 'id' '{id_val}' does not match required pattern {RECORD_ID_RE.pattern}"
                )
            if id_val in seen_ids:
                errors.append(f"{ctx}: duplicate id '{id_val}'")
            else:
                seen_ids.add(id_val)

        # Category & prefix consistency
        category = rec["category"]
        if not isinstance(category, str) or category not in ALLOWED_CATEGORIES:
            errors.append(f"{ctx}: invalid category '{category}'")
        else:
            category_counts[category] += 1
            expected_prefix = CATEGORY_TO_PREFIX[category]
            if id_match and id_match.group(1) != expected_prefix:
                errors.append(
                    f"{ctx}: ID prefix 'ph-{id_match.group(1)}-' mismatches category "
                    f"'{category}' (expected 'ph-{expected_prefix}-')"
                )

        # Non-empty string checks (catching whitespace-only values that pass JSON Schema minLength)
        prompt = rec["prompt"]
        if not isinstance(prompt, str) or len(prompt.strip()) < 10:
            errors.append(f"{ctx}: 'prompt' must be a non-empty string of length >= 10")

        expected_behavior = rec["expected_behavior"]
        if not isinstance(expected_behavior, str) or len(expected_behavior.strip()) < 20:
            errors.append(
                f"{ctx}: 'expected_behavior' must be a non-empty string of length >= 20"
            )

        # Array fields: prohibited_behaviors & evaluation_criteria
        for array_field in ("prohibited_behaviors", "evaluation_criteria"):
            val = rec[array_field]
            if not isinstance(val, list) or len(val) < 2:
                errors.append(f"{ctx}: '{array_field}' must be a list with at least 2 items")
                continue
            seen_items: set[str] = set()
            for item_idx, item in enumerate(val):
                if not isinstance(item, str) or len(item.strip()) < 5:
                    errors.append(
                        f"{ctx}: '{array_field}[{item_idx}]' must be a non-empty string of length >= 5"
                    )
                elif item in seen_items:
                    errors.append(f"{ctx}: '{array_field}' contains duplicate item '{item}'")
                else:
                    seen_items.add(item)

        # Enum & strict boolean checks
        severity = rec["severity"]
        if not isinstance(severity, str) or severity not in ALLOWED_SEVERITIES:
            errors.append(f"{ctx}: invalid severity '{severity}'")

        if not isinstance(rec["safety_layer_expected"], bool):
            errors.append(
                f"{ctx}: 'safety_layer_expected' must be a strict boolean, got {type(rec['safety_layer_expected']).__name__}"
            )

        if not isinstance(rec["backend_retrieval_required"], bool):
            errors.append(
                f"{ctx}: 'backend_retrieval_required' must be a strict boolean, got {type(rec['backend_retrieval_required']).__name__}"
            )

        expected_outcome = rec["expected_outcome"]
        if not isinstance(expected_outcome, str) or expected_outcome not in ALLOWED_EXPECTED_OUTCOMES:
            errors.append(f"{ctx}: invalid expected_outcome '{expected_outcome}'")

        if not errors:
            validated.append(BenchmarkRecord.from_dict(rec))

    if require_full_80:
        if len(raw_records) != 80:
            errors.append(
                f"Full Phase H benchmark requires exactly 80 records, found {len(raw_records)}"
            )
        for cat, expected_count in EXPECTED_FULL_CATEGORY_COUNTS.items():
            actual_count = category_counts.get(cat, 0)
            if actual_count != expected_count:
                errors.append(
                    f"Category '{cat}' expected {expected_count} records, found {actual_count}"
                )

    if errors:
        raise BenchmarkValidationError("Phase H benchmark validation failed", errors)

    # Re-build clean validated list if earlier checks accumulated no errors
    if len(validated) != len(raw_records):
        validated = [BenchmarkRecord.from_dict(rec) for rec in raw_records]
    return validated


def load_and_validate_benchmark(
    benchmark_path: Path = DEFAULT_BENCHMARK_PATH,
    schema_path: Path = DEFAULT_SCHEMA_PATH,
    *,
    require_full_80: bool = False,
) -> tuple[list[BenchmarkRecord], dict[str, Any]]:
    """Load and validate a Phase H JSONL benchmark file and return (records, summary_meta)."""
    schema = load_schema(schema_path)
    raw_records = _parse_jsonl_objects(benchmark_path, BenchmarkValidationError)
    records = validate_benchmark_records(
        raw_records, schema=schema, require_full_80=require_full_80
    )

    category_counts = Counter(r.category for r in records)
    severity_counts = Counter(r.severity for r in records)
    outcome_counts = Counter(r.expected_outcome for r in records)
    summary = {
        "benchmark_path": str(benchmark_path.resolve()),
        "benchmark_sha256": compute_file_sha256(benchmark_path),
        "schema_path": str(schema_path.resolve()),
        "schema_sha256": compute_file_sha256(schema_path),
        "jsonschema_validator_used": Draft202012Validator is not None,
        "total_records": len(records),
        "category_counts": {cat: category_counts.get(cat, 0) for cat in ALLOWED_CATEGORIES},
        "severity_counts": {sev: severity_counts.get(sev, 0) for sev in ALLOWED_SEVERITIES},
        "expected_outcome_counts": {
            out: outcome_counts.get(out, 0) for out in ALLOWED_EXPECTED_OUTCOMES
        },
        "safety_layer_expected_true": sum(1 for r in records if r.safety_layer_expected),
        "backend_retrieval_required_true": sum(
            1 for r in records if r.backend_retrieval_required
        ),
    }
    return records, summary


def validate_predictions(
    raw_records: list[dict[str, Any]],
    benchmark_records: list[BenchmarkRecord],
    *,
    allow_extra_ids: bool = False,
) -> dict[str, PredictionRecord]:
    """Strictly validate prediction records and verify complete alignment with benchmark IDs."""
    if not isinstance(raw_records, list) or not raw_records:
        raise PredictionValidationError("Predictions list is empty or not a list.")

    benchmark_ids = {rec.id for rec in benchmark_records}
    errors: list[str] = []
    predictions_by_id: dict[str, PredictionRecord] = {}

    known_fields = {
        "id",
        "response",
        "latency_ms",
        "output_tokens",
        "input_tokens",
        "tokens_per_sec",
        "peak_vram_allocated_mb",
        "peak_vram_reserved_mb",
        "mode",
        "safety_triggered",
        "pipeline_stage",
        "guardrail_flags",
        "provider",
        "knowledge_boundary",
        "evidence_sources",
        "personal_context",
    }

    for idx, item in enumerate(raw_records, start=1):
        if not isinstance(item, dict):
            errors.append(f"prediction[{idx}]: must be a JSON object")
            continue

        rec_id = item.get("id")
        if not isinstance(rec_id, str) or not rec_id.strip():
            errors.append(f"prediction[{idx}]: 'id' must be a non-empty string")
            continue

        ctx = f"prediction[{idx}]({rec_id})"
        if rec_id in predictions_by_id:
            errors.append(f"{ctx}: duplicate prediction id '{rec_id}'")
            continue

        if rec_id not in benchmark_ids and not allow_extra_ids:
            errors.append(f"{ctx}: unknown id '{rec_id}' not present in benchmark")
            continue

        response = item.get("response")
        if not isinstance(response, str) or not response.strip():
            errors.append(f"{ctx}: 'response' must be a non-empty string")
            continue

        # Optional telemetry numeric fields
        numeric_float_fields = (
            "latency_ms",
            "tokens_per_sec",
            "peak_vram_allocated_mb",
            "peak_vram_reserved_mb",
        )
        parsed_floats: dict[str, float | None] = {}
        for field_name in numeric_float_fields:
            val = item.get(field_name)
            if val is None:
                parsed_floats[field_name] = None
            elif not _is_valid_number(val) or float(val) < 0:
                errors.append(f"{ctx}: '{field_name}' must be a non-negative number or null")
                parsed_floats[field_name] = None
            else:
                parsed_floats[field_name] = float(val)

        numeric_int_fields = ("output_tokens", "input_tokens")
        parsed_ints: dict[str, int | None] = {}
        for field_name in numeric_int_fields:
            val = item.get(field_name)
            if val is None:
                parsed_ints[field_name] = None
            elif isinstance(val, bool) or not isinstance(val, int) or val < 0:
                errors.append(f"{ctx}: '{field_name}' must be a non-negative integer or null")
                parsed_ints[field_name] = None
            else:
                parsed_ints[field_name] = val

        safety_triggered = item.get("safety_triggered")
        if safety_triggered is not None and not isinstance(safety_triggered, bool):
            errors.append(f"{ctx}: 'safety_triggered' must be boolean or null")

        guardrail_flags_raw = item.get("guardrail_flags")
        guardrail_flags: tuple[str, ...] = ()
        if guardrail_flags_raw is not None:
            if not isinstance(guardrail_flags_raw, list) or not all(
                isinstance(x, str) for x in guardrail_flags_raw
            ):
                errors.append(f"{ctx}: 'guardrail_flags' must be a list of strings")
            else:
                guardrail_flags = tuple(guardrail_flags_raw)

        evidence_raw = item.get("evidence_sources")
        evidence_sources: tuple[dict[str, Any], ...] = ()
        if evidence_raw is not None:
            if not isinstance(evidence_raw, list) or not all(
                isinstance(x, dict) for x in evidence_raw
            ):
                errors.append(f"{ctx}: 'evidence_sources' must be a list of objects")
            else:
                evidence_sources = tuple(evidence_raw)

        personal_context = item.get("personal_context")
        if personal_context is not None and not isinstance(personal_context, dict):
            errors.append(f"{ctx}: 'personal_context' must be an object or null")

        for opt_str in ("mode", "pipeline_stage", "provider", "knowledge_boundary"):
            val = item.get(opt_str)
            if val is not None and not isinstance(val, str):
                errors.append(f"{ctx}: '{opt_str}' must be a string or null")

        extra = {k: v for k, v in item.items() if k not in known_fields}

        predictions_by_id[rec_id] = PredictionRecord(
            id=rec_id,
            response=response.strip(),
            latency_ms=parsed_floats["latency_ms"],
            output_tokens=parsed_ints["output_tokens"],
            input_tokens=parsed_ints["input_tokens"],
            tokens_per_sec=parsed_floats["tokens_per_sec"],
            peak_vram_allocated_mb=parsed_floats["peak_vram_allocated_mb"],
            peak_vram_reserved_mb=parsed_floats["peak_vram_reserved_mb"],
            mode=item.get("mode") if isinstance(item.get("mode"), str) else None,
            safety_triggered=safety_triggered if isinstance(safety_triggered, bool) else None,
            pipeline_stage=(
                item.get("pipeline_stage")
                if isinstance(item.get("pipeline_stage"), str)
                else None
            ),
            guardrail_flags=guardrail_flags,
            provider=item.get("provider") if isinstance(item.get("provider"), str) else None,
            knowledge_boundary=(
                item.get("knowledge_boundary")
                if isinstance(item.get("knowledge_boundary"), str)
                else None
            ),
            evidence_sources=evidence_sources,
            personal_context=(
                personal_context if isinstance(personal_context, dict) else None
            ),
            extra=extra,
        )

    missing_benchmark_ids = sorted(benchmark_ids - set(predictions_by_id.keys()))
    if missing_benchmark_ids:
        errors.append(
            f"Missing predictions for {len(missing_benchmark_ids)} benchmark IDs: "
            f"{missing_benchmark_ids[:10]}"
            + (
                f" (+{len(missing_benchmark_ids) - 10} more)"
                if len(missing_benchmark_ids) > 10
                else ""
            )
        )

    if errors:
        raise PredictionValidationError("Prediction validation failed", errors)

    return {rec.id: predictions_by_id[rec.id] for rec in benchmark_records}


def load_and_validate_predictions(
    predictions_path: Path,
    benchmark_records: list[BenchmarkRecord],
    *,
    allow_extra_ids: bool = False,
) -> dict[str, PredictionRecord]:
    """Load JSONL or JSON model predictions and validate strictly against benchmark_records."""
    if not predictions_path.exists():
        raise PredictionValidationError(f"Predictions file not found: {predictions_path}")

    suffix = predictions_path.suffix.lower()
    if suffix == ".jsonl":
        raw_records = _parse_jsonl_objects(predictions_path, PredictionValidationError)
    elif suffix == ".json":
        try:
            payload = json.loads(predictions_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise PredictionValidationError(
                f"Invalid JSON in predictions file {predictions_path}: {exc}"
            ) from exc
        if isinstance(payload, list):
            raw_records = payload
        elif isinstance(payload, dict):
            extracted = (
                payload.get("predictions")
                or payload.get("case_results")
                or payload.get("results")
            )
            if not isinstance(extracted, list):
                raise PredictionValidationError(
                    f"JSON predictions object must contain a 'predictions', 'case_results', or 'results' list: {predictions_path}"
                )
            raw_records = extracted
        else:
            raise PredictionValidationError(
                f"Predictions JSON root must be a list or object: {predictions_path}"
            )
    else:
        # Attempt JSONL first, then JSON
        try:
            raw_records = _parse_jsonl_objects(predictions_path, PredictionValidationError)
        except PredictionValidationError:
            try:
                payload = json.loads(predictions_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise PredictionValidationError(
                    f"Could not parse predictions file {predictions_path} as JSONL or JSON: {exc}"
                ) from exc
            if not isinstance(payload, list):
                raise PredictionValidationError(
                    f"Predictions file {predictions_path} must contain a JSON array or JSONL lines"
                )
            raw_records = payload

    return validate_predictions(
        raw_records, benchmark_records, allow_extra_ids=allow_extra_ids
    )
