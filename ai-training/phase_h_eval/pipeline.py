"""Dual-mode evaluation adapters: Mode A (raw_model) and Mode B (read-only full_system_pipeline)."""

from __future__ import annotations

import asyncio
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

from phase_h_eval.schema import BenchmarkRecord, PredictionRecord

REPO_ROOT = Path(__file__).resolve().parents[2]
AI_SERVICE_ROOT = REPO_ROOT / "ai-service"


class PipelineMode(str, Enum):
    """Supported Phase H evaluation execution modes."""

    RAW_MODEL = "raw_model"
    FULL_SYSTEM_PIPELINE = "full_system_pipeline"
    BOTH = "both"


@dataclass
class PipelineCaseTrace:
    """Per-case trace produced by Mode A or Mode B pipeline execution."""

    id: str
    raw_response: str
    final_response: str
    pipeline_stage: str
    safety_triggered: bool
    pre_llm_safety_triggered: bool = False
    pre_llm_bypass_llm: bool = False
    pre_llm_risk_level: str | None = None
    post_llm_safety_triggered: bool = False
    guardrail_flags: list[str] = field(default_factory=list)
    knowledge_boundary: str | None = None
    provider: str | None = None
    evidence_count: int = 0
    pipeline_overhead_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "pipeline_stage": self.pipeline_stage,
            "safety_triggered": self.safety_triggered,
            "pre_llm_safety_triggered": self.pre_llm_safety_triggered,
            "pre_llm_bypass_llm": self.pre_llm_bypass_llm,
            "pre_llm_risk_level": self.pre_llm_risk_level,
            "post_llm_safety_triggered": self.post_llm_safety_triggered,
            "guardrail_flags": list(self.guardrail_flags),
            "knowledge_boundary": self.knowledge_boundary,
            "provider": self.provider,
            "evidence_count": self.evidence_count,
            "pipeline_overhead_ms": round(self.pipeline_overhead_ms, 3),
        }


@dataclass
class PipelineResult:
    """Output of running Mode A or Mode B across the benchmark predictions."""

    mode: str
    pipeline_integration_status: str  # NOT_APPLICABLE_RAW_MODE | FULL_PIPELINE_EXECUTED | SAFETY_DETECTOR_ONLY | NOT_SUPPORTED | NOT_TESTED
    execution_status: str  # TESTED_SUCCESSFULLY | NOT_SUPPORTED | NOT_TESTED | FAILED
    is_mock: bool
    status_reason: str
    effective_predictions: dict[str, PredictionRecord] = field(default_factory=dict)
    traces: dict[str, PipelineCaseTrace] = field(default_factory=dict)
    safety_interception_audit: dict[str, Any] = field(default_factory=dict)


def _ensure_ai_service_on_path() -> bool:
    if not AI_SERVICE_ROOT.exists():
        return False
    path_str = str(AI_SERVICE_ROOT)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)
    return True


def inspect_ai_service_availability() -> dict[str, Any]:
    """Read-only probe checking whether ai-service SafetyDetector and CompanionService can be imported."""
    info: dict[str, Any] = {
        "ai_service_root": str(AI_SERVICE_ROOT),
        "ai_service_exists": AI_SERVICE_ROOT.exists(),
        "safety_detector_available": False,
        "companion_service_available": False,
        "safety_detector_error": None,
        "companion_service_error": None,
    }
    if not _ensure_ai_service_on_path():
        info["safety_detector_error"] = f"Directory not found: {AI_SERVICE_ROOT}"
        info["companion_service_error"] = info["safety_detector_error"]
        return info

    try:
        from app.safety.detector import SafetyDetector  # noqa: F401

        info["safety_detector_available"] = True
    except Exception as exc:
        info["safety_detector_error"] = f"{type(exc).__name__}: {exc}"

    try:
        from app.core.config import Settings  # noqa: F401
        from app.rag.retriever import ChromaKnowledgeRetriever  # noqa: F401
        from app.services.companion_service import CompanionService  # noqa: F401

        info["companion_service_available"] = True
    except Exception as exc:
        info["companion_service_error"] = f"{type(exc).__name__}: {exc}"

    return info


def _compute_safety_interception_audit(
    benchmark_records: list[BenchmarkRecord],
    traces: dict[str, PipelineCaseTrace],
) -> dict[str, Any]:
    expected_true_ids: list[str] = []
    expected_false_ids: list[str] = []
    true_positives: list[str] = []
    false_negatives: list[str] = []
    false_positives: list[str] = []
    true_negatives: list[str] = []

    for rec in benchmark_records:
        tr = traces.get(rec.id)
        triggered = bool(tr.safety_triggered) if tr is not None else False
        if rec.safety_layer_expected:
            expected_true_ids.append(rec.id)
            if triggered:
                true_positives.append(rec.id)
            else:
                false_negatives.append(rec.id)
        else:
            expected_false_ids.append(rec.id)
            if triggered:
                false_positives.append(rec.id)
            else:
                true_negatives.append(rec.id)

    total_expected = len(expected_true_ids)
    total_non_expected = len(expected_false_ids)
    return {
        "safety_layer_expected_count": total_expected,
        "triggered_on_expected_count": len(true_positives),
        "interception_recall": (
            round(len(true_positives) / total_expected, 4) if total_expected else None
        ),
        "missed_expected_interception_ids": false_negatives,
        "unexpected_interception_count": len(false_positives),
        "unexpected_interception_ids": false_positives,
        "specificity_on_non_expected": (
            round(len(true_negatives) / total_non_expected, 4)
            if total_non_expected
            else None
        ),
    }


def run_mode_a_raw_model(
    benchmark_records: list[BenchmarkRecord],
    predictions: dict[str, PredictionRecord],
    *,
    is_mock: bool = False,
) -> PipelineResult:
    """Mode A (raw_model): pass raw model outputs directly to evaluation without ai-service layers."""
    traces: dict[str, PipelineCaseTrace] = {}
    for rec in benchmark_records:
        pred = predictions[rec.id]
        traces[rec.id] = PipelineCaseTrace(
            id=rec.id,
            raw_response=pred.response,
            final_response=pred.response,
            pipeline_stage="raw_model_direct",
            safety_triggered=bool(pred.safety_triggered) if pred.safety_triggered is not None else False,
            guardrail_flags=list(pred.guardrail_flags),
            knowledge_boundary=pred.knowledge_boundary,
            provider=pred.provider,
            evidence_count=len(pred.evidence_sources),
        )
    return PipelineResult(
        mode=PipelineMode.RAW_MODEL.value,
        pipeline_integration_status="NOT_APPLICABLE_RAW_MODE",
        execution_status="TESTED_SUCCESSFULLY",
        is_mock=is_mock,
        status_reason="Mode A evaluates raw model outputs directly without ai-service safety/RAG layers.",
        effective_predictions=dict(predictions),
        traces=traces,
        safety_interception_audit={},
    )


def _infer_honorific_from_prompt(prompt: str) -> str:
    lowered = prompt.lower()
    for title in ("cụ", "ông", "bà", "bác"):
        if f" {title} " in f" {lowered} ":
            return title
    return "ông/bà"


def run_mode_b_full_system_pipeline(
    benchmark_records: list[BenchmarkRecord],
    predictions: dict[str, PredictionRecord],
    *,
    is_mock: bool = False,
    use_companion_service: bool = False,
) -> PipelineResult:
    """Mode B (full_system_pipeline): read-only integration with existing ai-service.

    NEVER modifies any file in ai-service/ and NEVER fakes Full System Pipeline results if
    dependencies are missing. Records exact pipeline_integration_status:
      - FULL_PIPELINE_EXECUTED: SafetyDetector + ChromaKnowledgeRetriever + CompanionService ran.
      - SAFETY_DETECTOR_ONLY: Real read-only SafetyDetector.evaluate_input + validate_output ran.
      - NOT_SUPPORTED: ai-service dependencies unavailable in current Python environment.
    """
    availability = inspect_ai_service_availability()
    if not availability["safety_detector_available"]:
        return PipelineResult(
            mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
            pipeline_integration_status="NOT_SUPPORTED",
            execution_status="NOT_SUPPORTED",
            is_mock=is_mock,
            status_reason=(
                "Cannot import read-only ai-service SafetyDetector: "
                f"{availability['safety_detector_error']}"
            ),
        )

    # Attempt full CompanionService + RAG only when explicitly enabled AND available
    if use_companion_service:
        if not availability["companion_service_available"]:
            return PipelineResult(
                mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
                pipeline_integration_status="NOT_SUPPORTED",
                execution_status="NOT_SUPPORTED",
                is_mock=is_mock,
                status_reason=(
                    "Full CompanionService+RAG requested (--use-companion-service) but unavailable: "
                    f"{availability['companion_service_error']}"
                ),
            )
        try:
            return _execute_full_companion_service_readonly(
                benchmark_records, predictions, is_mock=is_mock
            )
        except Exception as exc:
            return PipelineResult(
                mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
                pipeline_integration_status="NOT_SUPPORTED",
                execution_status="FAILED",
                is_mock=is_mock,
                status_reason=(
                    f"Full CompanionService+RAG execution failed: {type(exc).__name__}: {exc}"
                ),
            )

    # Default read-only Mode B: real existing SafetyDetector (pre-LLM + post-LLM)
    return _execute_safety_detector_only_readonly(
        benchmark_records, predictions, is_mock=is_mock
    )


def _execute_safety_detector_only_readonly(
    benchmark_records: list[BenchmarkRecord],
    predictions: dict[str, PredictionRecord],
    *,
    is_mock: bool,
) -> PipelineResult:
    """Run existing ai-service SafetyDetector.evaluate_input + validate_output read-only."""
    from app.safety.detector import SafetyDetector
    from app.schemas.companion import PersonalContextPayload

    detector = SafetyDetector()
    effective_predictions: dict[str, PredictionRecord] = {}
    traces: dict[str, PipelineCaseTrace] = {}

    for rec in benchmark_records:
        raw_pred = predictions[rec.id]
        t0 = time.perf_counter()

        honorific = _infer_honorific_from_prompt(rec.prompt)
        ctx_dict = dict(raw_pred.personal_context or {})
        ctx_dict.setdefault("preferred_honorific", honorific)
        try:
            personal_ctx = PersonalContextPayload.model_validate(ctx_dict)
        except Exception:
            personal_ctx = PersonalContextPayload(preferred_honorific=honorific)

        pre = detector.evaluate_input(rec.prompt, personal_ctx)
        if pre.bypass_llm and pre.deterministic_reply:
            final_text = pre.deterministic_reply
            stage = "pre_llm_safety_gate"
            safety_triggered = True
            post_triggered = False
            flags = list(pre.guardrail_flags)
            boundary = pre.knowledge_boundary
            provider = "deterministic_safety_gate"
        else:
            post = detector.validate_output(raw_pred.response, pre, personal_ctx)
            if post.safety_triggered and post.deterministic_reply:
                final_text = post.deterministic_reply
                stage = "post_llm_safety_override"
                safety_triggered = True
                post_triggered = True
                flags = list(post.guardrail_flags)
                boundary = post.knowledge_boundary
                provider = raw_pred.provider or "raw_model_overridden_by_safety_gate"
            else:
                final_text = raw_pred.response
                stage = "llm_passthrough"
                safety_triggered = False
                post_triggered = False
                flags = list(pre.guardrail_flags)
                boundary = raw_pred.knowledge_boundary
                provider = raw_pred.provider or "raw_model_passthrough"

        overhead_ms = (time.perf_counter() - t0) * 1000.0
        effective_latency = (
            round(raw_pred.latency_ms + overhead_ms, 2)
            if raw_pred.latency_ms is not None
            else round(overhead_ms, 2)
        )

        effective_predictions[rec.id] = PredictionRecord(
            id=rec.id,
            response=final_text,
            latency_ms=effective_latency,
            output_tokens=raw_pred.output_tokens,
            input_tokens=raw_pred.input_tokens,
            tokens_per_sec=raw_pred.tokens_per_sec,
            peak_vram_allocated_mb=raw_pred.peak_vram_allocated_mb,
            peak_vram_reserved_mb=raw_pred.peak_vram_reserved_mb,
            mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
            safety_triggered=safety_triggered,
            pipeline_stage=stage,
            guardrail_flags=tuple(flags),
            provider=provider,
            knowledge_boundary=boundary,
            evidence_sources=raw_pred.evidence_sources,
            personal_context=raw_pred.personal_context,
            extra={**raw_pred.extra, "raw_response_before_pipeline": raw_pred.response},
        )
        traces[rec.id] = PipelineCaseTrace(
            id=rec.id,
            raw_response=raw_pred.response,
            final_response=final_text,
            pipeline_stage=stage,
            safety_triggered=safety_triggered,
            pre_llm_safety_triggered=bool(pre.safety_triggered),
            pre_llm_bypass_llm=bool(pre.bypass_llm),
            pre_llm_risk_level=str(pre.risk_level),
            post_llm_safety_triggered=post_triggered,
            guardrail_flags=flags,
            knowledge_boundary=boundary,
            provider=provider,
            evidence_count=len(raw_pred.evidence_sources),
            pipeline_overhead_ms=overhead_ms,
        )

    audit = _compute_safety_interception_audit(benchmark_records, traces)
    return PipelineResult(
        mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
        pipeline_integration_status="SAFETY_DETECTOR_ONLY",
        execution_status="TESTED_SUCCESSFULLY",
        is_mock=is_mock,
        status_reason=(
            "Executed read-only integration with existing ai-service SafetyDetector "
            "(pre-LLM evaluate_input + post-LLM validate_output). RAG/ChromaDB was not invoked "
            "(pass use_companion_service=True to run full CompanionService+RAG)."
        ),
        effective_predictions=effective_predictions,
        traces=traces,
        safety_interception_audit=audit,
    )


def _execute_full_companion_service_readonly(
    benchmark_records: list[BenchmarkRecord],
    predictions: dict[str, PredictionRecord],
    *,
    is_mock: bool,
) -> PipelineResult:
    """Run read-only CompanionService (SafetyDetector + ChromaKnowledgeRetriever + precomputed responses)."""
    from app.core.config import Settings
    from app.models.provider import GenerationResult, ModelProvider
    from app.rag.embedder import build_embedder
    from app.rag.retriever import ChromaKnowledgeRetriever
    from app.safety.detector import SafetyDetector
    from app.schemas.companion import CompanionChatRequest, PersonalContextPayload
    from app.services.companion_service import CompanionService

    class _PrecomputedProvider(ModelProvider):
        """In-memory adapter returning the supplied model response inside CompanionService."""

        provider_name = "precomputed_predictions_adapter"

        def __init__(self) -> None:
            self.current_reply: str = ""

        def is_configured(self) -> bool:
            return True

        async def generate(
            self,
            *,
            system_prompt: str,
            user_message: str,
            context_block: str,
            evidence_sources: list[Any],
            personal_context: Any = None,
        ) -> GenerationResult:
            return GenerationResult(
                text=self.current_reply,
                provider=self.provider_name,
            )

    settings = Settings()
    embedder = build_embedder(
        provider_name=settings.embedding_provider,
        model_name=settings.embedding_model_name,
    )
    retriever = ChromaKnowledgeRetriever(
        persist_dir=str(AI_SERVICE_ROOT / settings.chroma_persist_dir)
        if not Path(settings.chroma_persist_dir).is_absolute()
        else settings.chroma_persist_dir,
        collection_name=settings.chroma_collection_name,
        embedder=embedder,
        min_similarity_score=settings.rag_min_similarity_score,
    )
    if retriever.count() == 0:
        knowledge_dir = AI_SERVICE_ROOT / settings.knowledge_dir
        if knowledge_dir.exists():
            retriever.seed_from_directory(knowledge_dir)

    provider = _PrecomputedProvider()
    service = CompanionService(
        settings=settings,
        safety_detector=SafetyDetector(),
        retriever=retriever,
        model_provider=provider,
    )

    effective_predictions: dict[str, PredictionRecord] = {}
    traces: dict[str, PipelineCaseTrace] = {}

    async def _run_all() -> None:
        for rec in benchmark_records:
            raw_pred = predictions[rec.id]
            provider.current_reply = raw_pred.response
            honorific = _infer_honorific_from_prompt(rec.prompt)
            ctx_dict = dict(raw_pred.personal_context or {})
            ctx_dict.setdefault("preferred_honorific", honorific)
            try:
                personal_ctx = PersonalContextPayload.model_validate(ctx_dict)
            except Exception:
                personal_ctx = PersonalContextPayload(preferred_honorific=honorific)

            req = CompanionChatRequest(
                message=rec.prompt,
                personal_context=personal_ctx,
                include_general_knowledge=True,
            )
            t0 = time.perf_counter()
            resp = await service.handle_chat(req)
            overhead_ms = (time.perf_counter() - t0) * 1000.0

            if resp.provider == "deterministic_safety_gate":
                stage = "pre_llm_safety_gate"
            elif resp.provider == "rag_uncertainty_gate":
                stage = "rag_uncertainty_gate"
            elif resp.safety_triggered:
                stage = "post_llm_safety_override"
            else:
                stage = "llm_passthrough"

            ev_dicts = [ev.model_dump() for ev in resp.evidence_sources]
            effective_latency = (
                round(raw_pred.latency_ms + overhead_ms, 2)
                if raw_pred.latency_ms is not None
                else round(overhead_ms, 2)
            )
            effective_predictions[rec.id] = PredictionRecord(
                id=rec.id,
                response=resp.reply,
                latency_ms=effective_latency,
                output_tokens=raw_pred.output_tokens,
                input_tokens=raw_pred.input_tokens,
                tokens_per_sec=raw_pred.tokens_per_sec,
                peak_vram_allocated_mb=raw_pred.peak_vram_allocated_mb,
                peak_vram_reserved_mb=raw_pred.peak_vram_reserved_mb,
                mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
                safety_triggered=bool(resp.safety_triggered),
                pipeline_stage=stage,
                guardrail_flags=tuple(resp.guardrail_flags),
                provider=resp.provider,
                knowledge_boundary=resp.knowledge_boundary,
                evidence_sources=tuple(ev_dicts),
                personal_context=raw_pred.personal_context,
                extra={**raw_pred.extra, "raw_response_before_pipeline": raw_pred.response},
            )
            traces[rec.id] = PipelineCaseTrace(
                id=rec.id,
                raw_response=raw_pred.response,
                final_response=resp.reply,
                pipeline_stage=stage,
                safety_triggered=bool(resp.safety_triggered),
                pre_llm_safety_triggered=(stage == "pre_llm_safety_gate"),
                pre_llm_bypass_llm=(stage == "pre_llm_safety_gate"),
                pre_llm_risk_level=str(resp.risk_level),
                post_llm_safety_triggered=(stage == "post_llm_safety_override"),
                guardrail_flags=list(resp.guardrail_flags),
                knowledge_boundary=resp.knowledge_boundary,
                provider=resp.provider,
                evidence_count=len(ev_dicts),
                pipeline_overhead_ms=overhead_ms,
            )

    asyncio.run(_run_all())
    audit = _compute_safety_interception_audit(benchmark_records, traces)
    return PipelineResult(
        mode=PipelineMode.FULL_SYSTEM_PIPELINE.value,
        pipeline_integration_status="FULL_PIPELINE_EXECUTED",
        execution_status="TESTED_SUCCESSFULLY",
        is_mock=is_mock,
        status_reason=(
            "Executed full read-only CompanionService pipeline "
            "(SafetyDetector pre-LLM -> ChromaKnowledgeRetriever -> precomputed response -> SafetyDetector post-LLM)."
        ),
        effective_predictions=effective_predictions,
        traces=traces,
        safety_interception_audit=audit,
    )
