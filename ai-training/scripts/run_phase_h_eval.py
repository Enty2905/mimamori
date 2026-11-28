#!/usr/bin/env python3
"""CLI runner for the dedicated Phase H Evaluation Engine & 5 Non-Compensatory Safety Gates.

Does NOT modify legacy evaluate_model.py, ai-service/, or benchmark datasets.
Supports:
  - Strict benchmark validation (--validate-only)
  - Mode A (raw_model), Mode B (full_system_pipeline), or dual-mode (--mode both)
  - Exporting JSON, CSV summary, optional per-case CSV, and Markdown reports
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

AI_TRAINING_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_TRAINING_ROOT.parent
if str(AI_TRAINING_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_TRAINING_ROOT))

from phase_h_eval.engine import PhaseHEvaluationEngine  # noqa: E402
from phase_h_eval.pipeline import PipelineMode, inspect_ai_service_availability  # noqa: E402
from phase_h_eval.reporting import (  # noqa: E402
    export_csv_summary,
    export_json_report,
    export_markdown_report,
    export_per_case_csv,
)
from phase_h_eval.schema import (  # noqa: E402
    DEFAULT_BENCHMARK_PATH,
    DEFAULT_SCHEMA_PATH,
    BenchmarkValidationError,
    PredictionValidationError,
    load_and_validate_benchmark,
)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_\-]+", "_", value.strip()).strip("_")
    return slug.lower() or "phase_h_run"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Mimamori Companion AI — Phase H Evaluation Engine & "
            "5 Non-Compensatory Safety Gates (GATE-1..GATE-5)."
        )
    )
    parser.add_argument(
        "--benchmark",
        type=Path,
        default=DEFAULT_BENCHMARK_PATH,
        help="Path to Phase H JSONL evaluation benchmark.",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=DEFAULT_SCHEMA_PATH,
        help="Path to Phase H JSON Schema file.",
    )
    parser.add_argument(
        "--predictions",
        type=Path,
        default=None,
        help="Path to JSONL or JSON model predictions file (required unless --validate-only).",
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=[m.value for m in PipelineMode],
        default=PipelineMode.RAW_MODEL.value,
        help="Evaluation mode: raw_model (Mode A), full_system_pipeline (Mode B), or both.",
    )
    parser.add_argument(
        "--model-id",
        type=str,
        default="unknown_model",
        help="Identifier of the evaluated model/checkpoint.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "evaluation-results" / "phase-h",
        help="Directory for exported JSON, CSV, and Markdown reports.",
    )
    parser.add_argument(
        "--output-prefix",
        type=str,
        default=None,
        help="Optional filename prefix for exported reports (default derived from model-id and mode).",
    )
    parser.add_argument(
        "--is-mock",
        action="store_true",
        help="Explicitly mark this evaluation run as using synthetic/mock predictions.",
    )
    parser.add_argument(
        "--require-full-80",
        action="store_true",
        help="Enforce exact 80-record Phase H category distribution (10/10/15/10/15/5/5/10).",
    )
    parser.add_argument(
        "--allow-extra-ids",
        action="store_true",
        help="Allow prediction files containing extra IDs beyond the selected benchmark.",
    )
    parser.add_argument(
        "--use-companion-service",
        action="store_true",
        help="In Mode B, attempt full read-only CompanionService + ChromaDB RAG instead of SafetyDetector-only.",
    )
    parser.add_argument(
        "--export-per-case-csv",
        action="store_true",
        help="Also export a detailed per-case CSV alongside the summary CSV.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate benchmark JSONL against schema and probe ai-service availability without evaluating predictions.",
    )
    parser.add_argument(
        "--fail-on-gate-failure",
        action="store_true",
        help="Return exit code 2 if overall_verdict != PASS.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.validate_only:
        try:
            records, summary = load_and_validate_benchmark(
                args.benchmark,
                args.schema,
                require_full_80=args.require_full_80,
            )
        except BenchmarkValidationError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            return 1
        availability = inspect_ai_service_availability()
        print(
            json.dumps(
                {
                    "status": "VALID",
                    "total_records": len(records),
                    "benchmark_summary": summary,
                    "ai_service_availability": availability,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if args.predictions is None:
        parser.error("--predictions is required unless --validate-only is specified.")

    try:
        engine = PhaseHEvaluationEngine(
            benchmark_path=args.benchmark,
            schema_path=args.schema,
            require_full_80=args.require_full_80,
        )
        report = engine.evaluate_from_file(
            args.predictions,
            mode=args.mode,
            model_id=args.model_id,
            is_mock=args.is_mock,
            use_companion_service=args.use_companion_service,
            allow_extra_ids=args.allow_extra_ids,
        )
    except (BenchmarkValidationError, PredictionValidationError) as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    prefix = args.output_prefix or f"{_slugify(args.model_id)}_{_slugify(args.mode)}"
    json_path = export_json_report(report, args.output_dir / f"{prefix}_results.json")
    csv_path = export_csv_summary(report, args.output_dir / f"{prefix}_summary.csv")
    md_path = export_markdown_report(report, args.output_dir / f"{prefix}_report.md")
    per_case_path = None
    if args.export_per_case_csv:
        per_case_path = export_per_case_csv(
            report, args.output_dir / f"{prefix}_per_case.csv"
        )

    compact_summary = {
        "run_id": report["metadata"]["run_id"],
        "model_id": report["metadata"]["model_id"],
        "mode": report["metadata"]["mode"],
        "is_mock": report["metadata"]["is_mock"],
        "execution_status": report["metadata"]["execution_status"],
        "pipeline_integration_status": report["metadata"]["pipeline_integration_status"],
        "overall_verdict": report["overall_verdict"],
        "outputs": {
            "json": str(json_path),
            "csv": str(csv_path),
            "markdown": str(md_path),
            "per_case_csv": str(per_case_path) if per_case_path else None,
        },
    }
    print(json.dumps(compact_summary, ensure_ascii=False, indent=2))

    if args.fail_on_gate_failure and report["overall_verdict"] != "PASS":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
