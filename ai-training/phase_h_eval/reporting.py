"""JSON, CSV, and Markdown report exporters for Phase H evaluation runs."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


def export_json_report(report: dict[str, Any], output_path: Path) -> Path:
    """Write full structured Phase H evaluation report as UTF-8 JSON."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def _extract_mode_reports(report: dict[str, Any]) -> list[dict[str, Any]]:
    if "modes" in report and isinstance(report["modes"], dict):
        return [
            report["modes"][k]
            for k in ("raw_model", "full_system_pipeline")
            if k in report["modes"]
        ]
    return [report]


def _gate_status_map(mode_report: dict[str, Any]) -> dict[str, str]:
    gates = mode_report.get("gates", {}).get("gates", [])
    return {str(g.get("gate_id", "")): str(g.get("status", "NOT_EVALUATED")) for g in gates}


def export_csv_summary(report: dict[str, Any], output_path: Path) -> Path:
    """Export flat summary CSV (one row per evaluated mode) with gates and all core/12 metrics."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "run_id",
        "timestamp_utc",
        "git_commit",
        "model_id",
        "mode",
        "is_mock",
        "execution_status",
        "pipeline_integration_status",
        "overall_verdict",
        "total_cases",
        "overall_pass_rate",
        "critical_failure_count",
        "high_failure_count",
        "GATE-1",
        "GATE-2",
        "GATE-3",
        "GATE-4",
        "GATE-5",
        "medical_safety",
        "emergency_escalation_accuracy",
        "unsafe_medication_advice_rate",
        "privacy_violation_rate",
        "unsupported_capability_claim_rate",
        "unsupported_capability_claims",
        "privacy_compliance",
        "hallucination_rate",
        "high_critical_hallucination_rate",
        "medication_safety_accuracy",
        "rag_factual_correctness",
        "vietnamese_naturalness",
        "empathy_and_respect",
        "clarity_and_tts_readability",
        "instruction_and_context_adherence",
        "refusal_correctness",
        "expected_behavior_coverage",
        "prohibited_records_count",
        "prohibited_records_rate",
        "mean_latency_ms",
        "p95_latency_ms",
        "mean_tokens_per_sec",
        "peak_vram_allocated_mb",
        "peak_vram_reserved_mb",
    ]

    mode_reports = _extract_mode_reports(report)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for mr in mode_reports:
            meta = mr.get("metadata", {})
            metrics = mr.get("metrics", {})
            prohib = metrics.get("prohibited_behavior_detection", {})
            runtime = metrics.get("runtime_efficiency_and_vram", {})
            gmap = _gate_status_map(mr)
            writer.writerow(
                {
                    "run_id": meta.get("run_id"),
                    "timestamp_utc": meta.get("timestamp_utc"),
                    "git_commit": meta.get("git_commit"),
                    "model_id": meta.get("model_id"),
                    "mode": meta.get("mode"),
                    "is_mock": meta.get("is_mock"),
                    "execution_status": meta.get("execution_status"),
                    "pipeline_integration_status": meta.get("pipeline_integration_status"),
                    "overall_verdict": mr.get("overall_verdict"),
                    "total_cases": metrics.get("total_cases"),
                    "overall_pass_rate": metrics.get("overall_pass_rate"),
                    "critical_failure_count": metrics.get("critical_failure_count"),
                    "high_failure_count": metrics.get("high_failure_count"),
                    "GATE-1": gmap.get("GATE-1", "NOT_EVALUATED"),
                    "GATE-2": gmap.get("GATE-2", "NOT_EVALUATED"),
                    "GATE-3": gmap.get("GATE-3", "NOT_EVALUATED"),
                    "GATE-4": gmap.get("GATE-4", "NOT_EVALUATED"),
                    "GATE-5": gmap.get("GATE-5", "NOT_EVALUATED"),
                    "medical_safety": metrics.get("medical_safety"),
                    "emergency_escalation_accuracy": metrics.get(
                        "emergency_escalation_accuracy"
                    ),
                    "unsafe_medication_advice_rate": metrics.get(
                        "unsafe_medication_advice_rate"
                    ),
                    "privacy_violation_rate": metrics.get("privacy_violation_rate"),
                    "unsupported_capability_claim_rate": metrics.get(
                        "unsupported_capability_claim_rate"
                    ),
                    "unsupported_capability_claims": metrics.get(
                        "unsupported_capability_claims"
                    ),
                    "privacy_compliance": metrics.get("privacy_compliance"),
                    "hallucination_rate": metrics.get("hallucination_rate"),
                    "high_critical_hallucination_rate": metrics.get(
                        "high_critical_hallucination_rate"
                    ),
                    "medication_safety_accuracy": metrics.get(
                        "medication_safety_accuracy"
                    ),
                    "rag_factual_correctness": metrics.get("rag_factual_correctness"),
                    "vietnamese_naturalness": metrics.get("vietnamese_naturalness"),
                    "empathy_and_respect": metrics.get("empathy_and_respect"),
                    "clarity_and_tts_readability": metrics.get(
                        "clarity_and_tts_readability"
                    ),
                    "instruction_and_context_adherence": metrics.get(
                        "instruction_and_context_adherence"
                    ),
                    "refusal_correctness": metrics.get("refusal_correctness"),
                    "expected_behavior_coverage": metrics.get(
                        "expected_behavior_coverage"
                    ),
                    "prohibited_records_count": prohib.get(
                        "records_with_prohibited_count"
                    ),
                    "prohibited_records_rate": prohib.get("records_with_prohibited_rate"),
                    "mean_latency_ms": runtime.get("mean_latency_ms"),
                    "p95_latency_ms": runtime.get("p95_latency_ms"),
                    "mean_tokens_per_sec": runtime.get("mean_tokens_per_sec"),
                    "peak_vram_allocated_mb": runtime.get("peak_vram_allocated_mb"),
                    "peak_vram_reserved_mb": runtime.get("peak_vram_reserved_mb"),
                }
            )
    return output_path


def export_per_case_csv(report: dict[str, Any], output_path: Path) -> Path:
    """Export per-case CSV diagnostics across evaluated mode(s)."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "mode",
        "id",
        "category",
        "severity",
        "expected_outcome",
        "passed",
        "pipeline_stage",
        "safety_triggered",
        "medical_safety",
        "emergency_escalation_accuracy",
        "unsupported_capability_claims",
        "privacy_compliance",
        "hallucination_rate",
        "medication_safety_accuracy",
        "rag_factual_correctness",
        "vietnamese_naturalness",
        "empathy_and_respect",
        "clarity_and_tts_readability",
        "refusal_correctness",
        "expected_behavior_coverage",
        "violation_codes",
        "latency_ms",
    ]

    mode_reports = _extract_mode_reports(report)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for mr in mode_reports:
            mode_name = mr.get("metadata", {}).get("mode", "")
            for case in mr.get("case_results", []):
                m = case.get("metrics", {})
                trace = case.get("pipeline_trace") or {}
                tel = case.get("telemetry") or {}
                vcodes = "; ".join(v.get("code", "") for v in case.get("violations", []))
                writer.writerow(
                    {
                        "mode": mode_name,
                        "id": case.get("id"),
                        "category": case.get("category"),
                        "severity": case.get("severity"),
                        "expected_outcome": case.get("expected_outcome"),
                        "passed": case.get("passed"),
                        "pipeline_stage": trace.get("pipeline_stage"),
                        "safety_triggered": trace.get("safety_triggered"),
                        "medical_safety": m.get("medical_safety"),
                        "emergency_escalation_accuracy": m.get(
                            "emergency_escalation_accuracy"
                        ),
                        "unsupported_capability_claims": m.get(
                            "unsupported_capability_claims"
                        ),
                        "privacy_compliance": m.get("privacy_compliance"),
                        "hallucination_rate": m.get("hallucination_rate"),
                        "medication_safety_accuracy": m.get("medication_safety_accuracy"),
                        "rag_factual_correctness": m.get("rag_factual_correctness"),
                        "vietnamese_naturalness": m.get("vietnamese_naturalness"),
                        "empathy_and_respect": m.get("empathy_and_respect"),
                        "clarity_and_tts_readability": m.get(
                            "clarity_and_tts_readability"
                        ),
                        "refusal_correctness": m.get("refusal_correctness"),
                        "expected_behavior_coverage": m.get("expected_behavior_coverage"),
                        "violation_codes": vcodes,
                        "latency_ms": tel.get("latency_ms"),
                    }
                )
    return output_path


def _fmt(val: Any) -> str:
    if val is None:
        return "N/A"
    if isinstance(val, float):
        return f"{val:.4f}"
    return str(val)


def _render_single_mode_markdown(mr: dict[str, Any]) -> list[str]:
    meta = mr.get("metadata", {})
    metrics = mr.get("metrics", {})
    gates_obj = mr.get("gates", {})
    gates = gates_obj.get("gates", [])
    prohib = metrics.get("prohibited_behavior_detection", {})
    runtime = metrics.get("runtime_efficiency_and_vram", {})

    lines: list[str] = [
        f"## Mode: `{meta.get('mode')}` — Verdict: `{mr.get('overall_verdict')}`",
        "",
        "| Field | Value |",
        "| :--- | :--- |",
        f"| `run_id` | `{meta.get('run_id')}` |",
        f"| `timestamp_utc` | `{meta.get('timestamp_utc')}` |",
        f"| `git_commit` | `{meta.get('git_commit')}` |",
        f"| `model_id` | `{meta.get('model_id')}` |",
        f"| `is_mock` | `{meta.get('is_mock')}` |",
        f"| `execution_status` | `{meta.get('execution_status')}` |",
        f"| `pipeline_integration_status` | `{meta.get('pipeline_integration_status')}` |",
        f"| `dataset_sha256` | `{meta.get('dataset_sha256')}` |",
        "",
        "### 5 Non-Compensatory Safety Gates (`GATE-1`..`GATE-5`)",
        "",
        f"- **Overall Verdict**: `{gates_obj.get('overall_verdict')}`",
        f"- **Critical Failures**: `{gates_obj.get('critical_failure_count', 0)}` "
        f"(`{gates_obj.get('critical_failing_record_ids', [])}`)",
        "",
        "| Gate | Name | Status | Threshold | Observed | Evaluated | Failing IDs |",
        "| :--- | :--- | :---: | :--- | :--- | ---: | :--- |",
    ]

    for g in gates:
        fail_ids = ", ".join(g.get("failing_record_ids", [])) or "None"
        lines.append(
            f"| `{g['gate_id']}` | {g['name']} | `{g['status']}` | "
            f"`{g['threshold']}` | `{g['observed_value']}` | {g['evaluated_count']} | {fail_ids} |"
        )

    # Gate alignment notes
    lines.extend(["", "#### Gate Alignment Notes", ""])
    for g in gates:
        for note in g.get("alignment_notes", []):
            lines.append(f"- **{g['gate_id']}**: {note}")

    lines.extend(
        [
            "",
            "### Core & 12-Metric Rubric Summary",
            "",
            "| Metric | Value |",
            "| :--- | ---: |",
            f"| `overall_pass_rate` | `{_fmt(metrics.get('overall_pass_rate'))}` ({metrics.get('passed_cases', 0)}/{metrics.get('total_cases', 0)}) |",
            f"| `critical_failure_count` | `{metrics.get('critical_failure_count')}` |",
            f"| `high_failure_count` | `{metrics.get('high_failure_count')}` |",
            f"| `medical_safety` (Tier A) | `{_fmt(metrics.get('medical_safety'))}` |",
            f"| `emergency_escalation_accuracy` (Tier A) | `{_fmt(metrics.get('emergency_escalation_accuracy'))}` |",
            f"| `unsupported_capability_claims` (Tier A) | `{_fmt(metrics.get('unsupported_capability_claims'))}` |",
            f"| `privacy_compliance` (Tier A) | `{_fmt(metrics.get('privacy_compliance'))}` |",
            f"| `hallucination_rate` (Tier A, lower=better) | `{_fmt(metrics.get('hallucination_rate'))}` (high+crit: `{_fmt(metrics.get('high_critical_hallucination_rate'))}`) |",
            f"| `unsafe_medication_advice_rate` | `{_fmt(metrics.get('unsafe_medication_advice_rate'))}` |",
            f"| `privacy_violation_rate` | `{_fmt(metrics.get('privacy_violation_rate'))}` |",
            f"| `unsupported_capability_claim_rate` | `{_fmt(metrics.get('unsupported_capability_claim_rate'))}` |",
            f"| `refusal_correctness` | `{_fmt(metrics.get('refusal_correctness'))}` |",
            f"| `expected_behavior_coverage` | `{_fmt(metrics.get('expected_behavior_coverage'))}` |",
            f"| `prohibited_behavior_detection` | `{prohib.get('records_with_prohibited_count', 0)}` records (`{_fmt(prohib.get('records_with_prohibited_rate'))}`), `{prohib.get('total_violation_instances', 0)}` total instances |",
            f"| `medication_safety_accuracy` (Tier B) | `{_fmt(metrics.get('medication_safety_accuracy'))}` |",
            f"| `rag_factual_correctness` (Tier B) | `{_fmt(metrics.get('rag_factual_correctness'))}` |",
            f"| `vietnamese_naturalness` (Tier B) | `{_fmt(metrics.get('vietnamese_naturalness'))}` |",
            f"| `empathy_and_respect` (Tier B) | `{_fmt(metrics.get('empathy_and_respect'))}` |",
            f"| `clarity_and_tts_readability` (Tier B) | `{_fmt(metrics.get('clarity_and_tts_readability'))}` |",
            f"| `instruction_and_context_adherence` (Tier B) | `{_fmt(metrics.get('instruction_and_context_adherence'))}` |",
            f"| `mean_latency_ms` / `p95_latency_ms` (Tier C) | `{runtime.get('mean_latency_ms')}` / `{runtime.get('p95_latency_ms')}` ms |",
            f"| `peak_vram_allocated_mb` / `reserved_mb` (Tier C) | `{runtime.get('peak_vram_allocated_mb')}` / `{runtime.get('peak_vram_reserved_mb')}` MB |",
            "",
            "### Breakdown by Category",
            "",
            "| Category | Passed | Total | Pass Rate |",
            "| :--- | ---: | ---: | ---: |",
        ]
    )
    for cat, stats in metrics.get("pass_rate_by_category", {}).items():
        lines.append(
            f"| `{cat}` | {stats['passed']} | {stats['total']} | `{_fmt(stats['rate'])}` |"
        )

    lines.extend(
        [
            "",
            "### Breakdown by Severity",
            "",
            "| Severity | Passed | Total | Pass Rate |",
            "| :--- | ---: | ---: | ---: |",
        ]
    )
    for sev, stats in metrics.get("pass_rate_by_severity", {}).items():
        lines.append(
            f"| `{sev}` | {stats['passed']} | {stats['total']} | `{_fmt(stats['rate'])}` |"
        )

    # Failing cases detail table
    failing_cases = [c for c in mr.get("case_results", []) if not c.get("passed")]
    if failing_cases:
        lines.extend(
            [
                "",
                f"### Failing Records ({len(failing_cases)})",
                "",
                "| ID | Category | Severity | Violations |",
                "| :--- | :--- | :---: | :--- |",
            ]
        )
        for c in failing_cases:
            vtext = "; ".join(
                f"`{v['code']}`: {v['message']}" for v in c.get("violations", [])
            ) or "Criteria/refusal check failed"
            lines.append(
                f"| `{c['id']}` | `{c['category']}` | `{c['severity']}` | {vtext} |"
            )

    interception = mr.get("safety_interception_audit") or {}
    if interception:
        lines.extend(
            [
                "",
                "### Safety Layer Interception Audit (Mode B)",
                "",
                f"- Expected Interceptions Triggered: `{interception.get('triggered_on_expected_count')}` / `{interception.get('safety_layer_expected_count')}` (recall=`{_fmt(interception.get('interception_recall'))}`)",
                f"- Missed Expected IDs: `{interception.get('missed_expected_interception_ids')}`",
                f"- Unexpected Interceptions: `{interception.get('unexpected_interception_count')}` (`{interception.get('unexpected_interception_ids')}`)",
            ]
        )

    lines.append("")
    return lines


def render_markdown_report(report: dict[str, Any]) -> str:
    """Render a complete human-readable Phase H Markdown evaluation report."""
    meta = report.get("metadata", {})
    lines: list[str] = [
        "# Mimamori Companion AI — Phase H Evaluation Report",
        "",
        f"- **Run ID**: `{meta.get('run_id')}`",
        f"- **Model**: `{meta.get('model_id')}` (`is_mock={meta.get('is_mock')}`)",
        f"- **Mode**: `{meta.get('mode')}`",
        f"- **Overall Verdict**: `{report.get('overall_verdict')}`",
        f"- **Generated (UTC)**: `{meta.get('timestamp_utc')}`",
        "",
    ]

    if "comparison" in report:
        cmp_data = report["comparison"]
        lines.extend(
            [
                "## Dual-Mode Comparison (`raw_model` vs `full_system_pipeline`)",
                "",
                "| Dimension | `raw_model` | `full_system_pipeline` | Delta |",
                "| :--- | :---: | :---: | :---: |",
                f"| Overall Verdict | `{cmp_data.get('raw_model_verdict')}` | `{cmp_data.get('full_system_pipeline_verdict')}` | — |",
                f"| Overall Pass Rate | `{_fmt(cmp_data.get('raw_model_overall_pass_rate'))}` | `{_fmt(cmp_data.get('full_system_pipeline_overall_pass_rate'))}` | `{_fmt(cmp_data.get('overall_pass_rate_delta'))}` |",
                f"| Critical Failures | `{cmp_data.get('raw_model_critical_failures')}` | `{cmp_data.get('full_system_pipeline_critical_failures')}` | — |",
                "",
            ]
        )

    for mr in _extract_mode_reports(report):
        lines.extend(_render_single_mode_markdown(mr))

    # Metric limitations section
    first_mr = _extract_mode_reports(report)[0]
    limits = first_mr.get("metrics", {}).get("metric_limitations", {})
    if limits:
        lines.extend(
            [
                "## Metric Limitations & Clinical Disclaimer",
                "",
                "### Verified Deterministically",
            ]
        )
        for item in limits.get("verified_deterministically", []):
            lines.append(f"- {item}")
        lines.extend(["", "### Cannot Verify Deterministically"])
        for item in limits.get("cannot_verify_deterministically", []):
            lines.append(f"- {item}")
        if limits.get("clinical_disclaimer"):
            lines.extend(["", f"> **Disclaimer:** {limits['clinical_disclaimer']}"])
        lines.append("")

    return "\n".join(lines)


def export_markdown_report(report: dict[str, Any], output_path: Path) -> Path:
    """Write rendered Markdown report to disk."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_markdown_report(report), encoding="utf-8")
    return output_path
