"""Main Phase H Evaluation Engine orchestrator with reproducibility metadata."""

from __future__ import annotations

import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from phase_h_eval.detectors import DetectorResult, evaluate_record_detectors
from phase_h_eval.gates import GateSummary, evaluate_safety_gates
from phase_h_eval.metrics import compute_all_metrics
from phase_h_eval.pipeline import (
    PipelineMode,
    PipelineResult,
    run_mode_a_raw_model,
    run_mode_b_full_system_pipeline,
)
from phase_h_eval.schema import (
    DEFAULT_BENCHMARK_PATH,
    DEFAULT_SCHEMA_PATH,
    BenchmarkRecord,
    PredictionRecord,
    load_and_validate_benchmark,
    load_and_validate_predictions,
    validate_predictions,
)

ENGINE_VERSION = "phase-h2.3-v1.0.0"
REPO_ROOT = Path(__file__).resolve().parents[2]


def _resolve_git_commit() -> str:
    try:
        proc = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        pass
    return "UNKNOWN"


class PhaseHEvaluationEngine:
    """Orchestrates Phase H benchmark validation, dual-mode execution, detectors, metrics, and gates."""

    def __init__(
        self,
        benchmark_path: Path = DEFAULT_BENCHMARK_PATH,
        schema_path: Path = DEFAULT_SCHEMA_PATH,
        *,
        require_full_80: bool = False,
    ) -> None:
        self.benchmark_path = Path(benchmark_path)
        self.schema_path = Path(schema_path)
        self.require_full_80 = require_full_80
        self.benchmark_records, self.benchmark_meta = load_and_validate_benchmark(
            self.benchmark_path,
            self.schema_path,
            require_full_80=require_full_80,
        )

    def _evaluate_single_mode(
        self,
        *,
        pipeline_result: PipelineResult,
        model_id: str,
        run_id: str,
        timestamp_utc: str,
        git_commit: str,
    ) -> dict[str, Any]:
        metadata = {
            "run_id": run_id,
            "timestamp_utc": timestamp_utc,
            "git_commit": git_commit,
            "engine_version": ENGINE_VERSION,
            "dataset_path": self.benchmark_meta["benchmark_path"],
            "dataset_sha256": self.benchmark_meta["benchmark_sha256"],
            "schema_path": self.benchmark_meta["schema_path"],
            "schema_sha256": self.benchmark_meta["schema_sha256"],
            "mode": pipeline_result.mode,
            "model_id": model_id,
            "is_mock": pipeline_result.is_mock,
            "execution_status": pipeline_result.execution_status,
            "pipeline_integration_status": pipeline_result.pipeline_integration_status,
            "status_reason": pipeline_result.status_reason,
            "total_benchmark_records": len(self.benchmark_records),
        }

        if pipeline_result.execution_status != "TESTED_SUCCESSFULLY":
            return {
                "metadata": metadata,
                "benchmark_summary": self.benchmark_meta,
                "overall_verdict": "NOT_EVALUATED",
                "gates": {
                    "overall_verdict": "NOT_EVALUATED",
                    "critical_failure_count": 0,
                    "critical_failing_record_ids": [],
                    "critical_failure_override": False,
                    "gates": [],
                },
                "metrics": compute_all_metrics([], {}),
                "safety_interception_audit": {},
                "case_results": [],
            }

        detector_results: list[DetectorResult] = []
        case_payloads: list[dict[str, Any]] = []

        for rec in self.benchmark_records:
            pred = pipeline_result.effective_predictions[rec.id]
            has_verified_ctx = bool(
                pred.personal_context
                and any(
                    pred.personal_context.get(k)
                    for k in (
                        "medication_schedules",
                        "medication_logs",
                        "health_notes",
                        "daily_checkin",
                    )
                )
            )
            det = evaluate_record_detectors(
                rec,
                pred.response,
                has_verified_backend_context=has_verified_ctx,
            )
            detector_results.append(det)

            trace = pipeline_result.traces.get(rec.id)
            case_payloads.append(
                {
                    **det.to_dict(),
                    "prompt": rec.prompt,
                    "response": pred.response,
                    "safety_layer_expected": rec.safety_layer_expected,
                    "backend_retrieval_required": rec.backend_retrieval_required,
                    "telemetry": {
                        "latency_ms": pred.latency_ms,
                        "output_tokens": pred.output_tokens,
                        "input_tokens": pred.input_tokens,
                        "tokens_per_sec": pred.tokens_per_sec,
                        "peak_vram_allocated_mb": pred.peak_vram_allocated_mb,
                        "peak_vram_reserved_mb": pred.peak_vram_reserved_mb,
                    },
                    "pipeline_trace": trace.to_dict() if trace is not None else None,
                }
            )

        gate_summary: GateSummary = evaluate_safety_gates(detector_results)
        metrics = compute_all_metrics(detector_results, pipeline_result.effective_predictions)

        return {
            "metadata": metadata,
            "benchmark_summary": self.benchmark_meta,
            "overall_verdict": gate_summary.overall_verdict,
            "gates": gate_summary.to_dict(),
            "metrics": metrics,
            "safety_interception_audit": pipeline_result.safety_interception_audit,
            "case_results": case_payloads,
        }

    def evaluate_prediction_records(
        self,
        predictions: dict[str, PredictionRecord],
        *,
        mode: str | PipelineMode = PipelineMode.RAW_MODEL,
        model_id: str = "unknown_model",
        is_mock: bool = False,
        use_companion_service: bool = False,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """Evaluate already-validated PredictionRecord mapping in Mode A, Mode B, or both."""
        mode_enum = PipelineMode(mode) if not isinstance(mode, PipelineMode) else mode
        resolved_run_id = run_id or f"ph-eval-{uuid.uuid4().hex[:12]}"
        timestamp_utc = datetime.now(timezone.utc).isoformat()
        git_commit = _resolve_git_commit()

        if mode_enum == PipelineMode.RAW_MODEL:
            pipe_res = run_mode_a_raw_model(
                self.benchmark_records, predictions, is_mock=is_mock
            )
            return self._evaluate_single_mode(
                pipeline_result=pipe_res,
                model_id=model_id,
                run_id=resolved_run_id,
                timestamp_utc=timestamp_utc,
                git_commit=git_commit,
            )

        if mode_enum == PipelineMode.FULL_SYSTEM_PIPELINE:
            pipe_res = run_mode_b_full_system_pipeline(
                self.benchmark_records,
                predictions,
                is_mock=is_mock,
                use_companion_service=use_companion_service,
            )
            return self._evaluate_single_mode(
                pipeline_result=pipe_res,
                model_id=model_id,
                run_id=resolved_run_id,
                timestamp_utc=timestamp_utc,
                git_commit=git_commit,
            )

        # Dual-mode comparison: Mode A + Mode B
        raw_pipe = run_mode_a_raw_model(
            self.benchmark_records, predictions, is_mock=is_mock
        )
        full_pipe = run_mode_b_full_system_pipeline(
            self.benchmark_records,
            predictions,
            is_mock=is_mock,
            use_companion_service=use_companion_service,
        )
        raw_report = self._evaluate_single_mode(
            pipeline_result=raw_pipe,
            model_id=model_id,
            run_id=f"{resolved_run_id}-raw",
            timestamp_utc=timestamp_utc,
            git_commit=git_commit,
        )
        full_report = self._evaluate_single_mode(
            pipeline_result=full_pipe,
            model_id=model_id,
            run_id=f"{resolved_run_id}-pipeline",
            timestamp_utc=timestamp_utc,
            git_commit=git_commit,
        )

        raw_pass = raw_report["metrics"].get("overall_pass_rate")
        full_pass = full_report["metrics"].get("overall_pass_rate")
        pass_delta = (
            round(full_pass - raw_pass, 4)
            if raw_pass is not None and full_pass is not None
            else None
        )

        return {
            "metadata": {
                "run_id": resolved_run_id,
                "timestamp_utc": timestamp_utc,
                "git_commit": git_commit,
                "engine_version": ENGINE_VERSION,
                "dataset_path": self.benchmark_meta["benchmark_path"],
                "dataset_sha256": self.benchmark_meta["benchmark_sha256"],
                "schema_path": self.benchmark_meta["schema_path"],
                "schema_sha256": self.benchmark_meta["schema_sha256"],
                "mode": PipelineMode.BOTH.value,
                "model_id": model_id,
                "is_mock": is_mock,
                "execution_status": (
                    "TESTED_SUCCESSFULLY"
                    if full_report["metadata"]["execution_status"] == "TESTED_SUCCESSFULLY"
                    else full_report["metadata"]["execution_status"]
                ),
                "pipeline_integration_status": full_report["metadata"][
                    "pipeline_integration_status"
                ],
                "total_benchmark_records": len(self.benchmark_records),
            },
            "overall_verdict": full_report["overall_verdict"],
            "comparison": {
                "raw_model_verdict": raw_report["overall_verdict"],
                "full_system_pipeline_verdict": full_report["overall_verdict"],
                "raw_model_overall_pass_rate": raw_pass,
                "full_system_pipeline_overall_pass_rate": full_pass,
                "overall_pass_rate_delta": pass_delta,
                "raw_model_critical_failures": raw_report["metrics"][
                    "critical_failure_count"
                ],
                "full_system_pipeline_critical_failures": full_report["metrics"][
                    "critical_failure_count"
                ],
            },
            "modes": {
                "raw_model": raw_report,
                "full_system_pipeline": full_report,
            },
        }

    def evaluate_from_file(
        self,
        predictions_path: Path,
        *,
        mode: str | PipelineMode = PipelineMode.RAW_MODEL,
        model_id: str = "unknown_model",
        is_mock: bool = False,
        use_companion_service: bool = False,
        allow_extra_ids: bool = False,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """Load predictions from a JSONL/JSON file, strictly validate, and evaluate."""
        preds = load_and_validate_predictions(
            Path(predictions_path),
            self.benchmark_records,
            allow_extra_ids=allow_extra_ids,
        )
        return self.evaluate_prediction_records(
            preds,
            mode=mode,
            model_id=model_id,
            is_mock=is_mock,
            use_companion_service=use_companion_service,
            run_id=run_id,
        )


def evaluate_predictions(
    raw_predictions: list[dict[str, Any]],
    *,
    benchmark_records: list[BenchmarkRecord] | None = None,
    benchmark_path: Path = DEFAULT_BENCHMARK_PATH,
    schema_path: Path = DEFAULT_SCHEMA_PATH,
    mode: str | PipelineMode = PipelineMode.RAW_MODEL,
    model_id: str = "unknown_model",
    is_mock: bool = False,
    use_companion_service: bool = False,
    require_full_80: bool = False,
    allow_extra_ids: bool = False,
) -> dict[str, Any]:
    """Convenience functional API for evaluating in-memory prediction dicts."""
    engine = PhaseHEvaluationEngine(
        benchmark_path=benchmark_path,
        schema_path=schema_path,
        require_full_80=require_full_80,
    )
    if benchmark_records is not None:
        engine.benchmark_records = benchmark_records
        engine.benchmark_meta = {
            **engine.benchmark_meta,
            "total_records": len(benchmark_records),
        }
    validated_preds = validate_predictions(
        raw_predictions,
        engine.benchmark_records,
        allow_extra_ids=allow_extra_ids,
    )
    return engine.evaluate_prediction_records(
        validated_preds,
        mode=mode,
        model_id=model_id,
        is_mock=is_mock,
        use_companion_service=use_companion_service,
    )
