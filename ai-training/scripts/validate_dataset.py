#!/usr/bin/env python3
"""Validate Mimamori Companion AI datasets for schema, safety, PII, and leakage."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ALLOWED_CATEGORIES: tuple[str, ...] = (
    "daily_conversation",
    "emotional_support",
    "elderly_companionship",
    "daily_routines",
    "medication_assistance",
    "basic_health_information",
    "emergency_situations",
    "unclear_or_insufficient_information",
)

ALLOWED_SAFETY_LEVELS: tuple[str, ...] = ("low", "medium", "high", "critical")
ALLOWED_ROLES: tuple[str, ...] = ("system", "user", "assistant")

CHAT_REQUIRED_FIELDS: tuple[str, ...] = (
    "id",
    "messages",
    "category",
    "safety_level",
    "language",
    "source",
    "reviewed",
    "review_notes",
)

EVAL_REQUIRED_FIELDS: tuple[str, ...] = (
    "id",
    "category",
    "safety_level",
    "prompt_messages",
    "expected_criteria",
    "must_include_signals",
    "forbidden_claims",
    "source",
    "reviewed",
)

# Regex checks for PII & secrets
VN_PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?84[\s.\-]?|0)(?:3|5|7|8|9)(?:[\s.\-]?\d){8}(?!\d)"
)
CCCD_CMND_RE = re.compile(r"(?<!\d)(?:\d{9}|\d{12})(?!\d)")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
SECRET_RE = re.compile(r"\b(?:gsk_|hf_|sk-)[A-Za-z0-9_\-]{16,}\b")

# Unsafe medical / prescribing / diagnosis patterns
DOSAGE_UNIT_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|ml|viên|gói|giọt|ống)\b",
    re.IGNORECASE,
)
PRESCRIBE_VERBS_RE = re.compile(
    r"\b(?:tăng liều|giảm liều|ngừng thuốc|bỏ thuốc|uống gấp đôi|uống bù|kê đơn)\b",
    re.IGNORECASE,
)
DIAGNOSIS_RE = re.compile(
    r"(?:chẩn đoán\s+(?:cụ|bác|ông|bà)\s+(?:bị|mắc)|"
    r"chắc chắn\s+(?:cụ|bác|ông|bà)\s+(?:bị|mắc)|"
    r"kết luận\s+(?:cụ|bác|ông|bà)\s+(?:bị|mắc))",
    re.IGNORECASE,
)
NEGATION_GUARD_RE = re.compile(
    r"(?:không|đừng|tránh|tuyệt đối|khoan|chưa|chớ|trước khi|khi chưa|chưa có chỉ định)\b",
    re.IGNORECASE,
)
FALSE_REASSURANCE_RE = re.compile(
    r"(?:không sao đâu|cứ ngủ|đợi đến mai|tự hết thôi|bình thường thôi đừng lo)",
    re.IGNORECASE,
)
THINK_TAG_RE = re.compile(r"</?think>", re.IGNORECASE)


def normalize_text(text: str) -> str:
    """Collapse whitespace and casefold for deterministic dedup and leakage checks."""
    return re.sub(r"\s+", " ", text.strip().casefold())


def text_fingerprint(text: str) -> str:
    """Return short SHA-256 fingerprint of normalized text."""
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()[:16]


def extract_user_turns(messages: list[dict[str, Any]]) -> list[str]:
    """Return normalized user messages from a conversation list."""
    return [
        normalize_text(str(msg.get("content", "")))
        for msg in messages
        if isinstance(msg, dict) and msg.get("role") == "user"
    ]


def extract_conversation_fingerprint(messages: list[dict[str, Any]]) -> str:
    """Compute fingerprint across all non-system turns."""
    joined = " | ".join(
        f"{m.get('role', '')}:{normalize_text(str(m.get('content', '')))}"
        for m in messages
        if isinstance(m, dict) and m.get("role") != "system"
    )
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:16]


def load_jsonl(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    """Load JSONL file and report any line-level JSON syntax errors."""
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    if not path.exists():
        errors.append(f"File not found: {path}")
        return records, errors

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
                errors.append(f"{path.name}:{line_no}: JSON line must be an object")
                continue
            records.append(obj)
    return records, errors


def check_pii(text: str) -> list[str]:
    """Detect Vietnamese phone numbers, CCCD/CMND IDs, emails, and leaked API tokens."""
    findings: list[str] = []
    if VN_PHONE_RE.search(text):
        findings.append("vn_phone_number")
    if CCCD_CMND_RE.search(text):
        findings.append("cccd_or_cmnd_digits")
    if EMAIL_RE.search(text):
        findings.append("email_address")
    if SECRET_RE.search(text):
        findings.append("secret_token_pattern")
    return findings


def has_preceding_negation(text: str, match_start: int, window: int = 45) -> bool:
    """Check whether a negation or caution qualifier guards a matched medical phrase."""
    prefix = text[max(0, match_start - window) : match_start]
    return bool(NEGATION_GUARD_RE.search(prefix))


def check_unsafe_assistant_reply(
    content: str,
    category: str,
    safety_level: str,
    is_final_turn: bool,
) -> list[str]:
    """Check assistant content for unguarded dosing, diagnosis, or emergency omissions."""
    issues: list[str] = []

    if THINK_TAG_RE.search(content):
        issues.append("contains_<think>_tag")

    if DOSAGE_UNIT_RE.search(content):
        issues.append("contains_specific_dosage_unit")

    for match in PRESCRIBE_VERBS_RE.finditer(content):
        if not has_preceding_negation(content, match.start()):
            issues.append(f"unguarded_prescribing_phrase:{match.group(0)}")

    for match in DIAGNOSIS_RE.finditer(content):
        if not has_preceding_negation(content, match.start()):
            issues.append(f"unguarded_diagnosis_phrase:{match.group(0)}")

    if category == "emergency_situations" or safety_level == "critical":
        if FALSE_REASSURANCE_RE.search(content):
            issues.append("emergency_false_reassurance")
        if is_final_turn:
            lowered = content.casefold()
            if "115" not in lowered and "cấp cứu" not in lowered:
                issues.append("emergency_missing_115_escalation")

    return issues


def validate_messages_structure(
    messages: Any,
    *,
    expect_end_role: str,
    context_label: str,
) -> list[str]:
    """Validate role allowlist, non-empty content, optional leading system, and alternation."""
    errors: list[str] = []
    if not isinstance(messages, list) or not messages:
        return [f"{context_label}: messages must be a non-empty list"]

    for idx, msg in enumerate(messages):
        if not isinstance(msg, dict):
            errors.append(f"{context_label}: message[{idx}] must be an object")
            continue
        role = msg.get("role")
        content = msg.get("content")
        if role not in ALLOWED_ROLES:
            errors.append(f"{context_label}: message[{idx}] invalid role '{role}'")
        if not isinstance(content, str) or not content.strip():
            errors.append(f"{context_label}: message[{idx}] content must be non-empty string")
        if idx > 0 and role == "system":
            errors.append(f"{context_label}: system message only allowed at index 0")

    if errors:
        return errors

    start_idx = 1 if messages[0]["role"] == "system" else 0
    turns = messages[start_idx:]
    if not turns:
        return [f"{context_label}: must contain at least one user turn"]
    if turns[0]["role"] != "user":
        errors.append(f"{context_label}: first conversational turn must be 'user'")
    if turns[-1]["role"] != expect_end_role:
        errors.append(
            f"{context_label}: last conversational turn must be '{expect_end_role}', "
            f"got '{turns[-1]['role']}'"
        )

    for idx in range(1, len(turns)):
        prev_role = turns[idx - 1]["role"]
        curr_role = turns[idx]["role"]
        expected_next = "assistant" if prev_role == "user" else "user"
        if curr_role != expected_next:
            errors.append(
                f"{context_label}: non-alternating role at conversational turn {idx}: "
                f"expected '{expected_next}', got '{curr_role}'"
            )

    return errors


def validate_chat_records(
    records: list[dict[str, Any]],
    dataset_name: str,
) -> dict[str, Any]:
    """Validate a chat dataset split (raw seed, train, val, or test)."""
    errors: list[str] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()
    seen_conv_hashes: dict[str, str] = {}
    seen_prompt_hashes: dict[str, str] = {}

    category_counts: Counter[str] = Counter()
    safety_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    reviewed_counts: Counter[str] = Counter()
    turn_counts: list[int] = []
    assistant_char_lengths: list[int] = []
    pii_hits: list[dict[str, Any]] = []
    safety_hits: list[dict[str, Any]] = []

    for idx, rec in enumerate(records, start=1):
        rec_id = str(rec.get("id", f"<missing-id-{idx}>"))
        ctx = f"{dataset_name}[{rec_id}]"

        missing = [f for f in CHAT_REQUIRED_FIELDS if f not in rec]
        if missing:
            errors.append(f"{ctx}: missing required fields: {missing}")
            continue

        if not isinstance(rec["id"], str) or not rec["id"].strip():
            errors.append(f"{ctx}: 'id' must be a non-empty string")
        elif rec["id"] in seen_ids:
            errors.append(f"{ctx}: duplicate id '{rec['id']}'")
        else:
            seen_ids.add(rec["id"])

        category = rec["category"]
        if category not in ALLOWED_CATEGORIES:
            errors.append(f"{ctx}: invalid category '{category}'")
        else:
            category_counts[category] += 1

        safety_level = rec["safety_level"]
        if safety_level not in ALLOWED_SAFETY_LEVELS:
            errors.append(f"{ctx}: invalid safety_level '{safety_level}'")
        else:
            safety_counts[safety_level] += 1

        if category == "emergency_situations" and safety_level not in {"high", "critical"}:
            errors.append(
                f"{ctx}: category 'emergency_situations' must have high/critical safety_level"
            )

        if rec["language"] != "vi":
            errors.append(f"{ctx}: expected language 'vi', got '{rec['language']}'")

        source = rec["source"]
        if not isinstance(source, str) or not source.strip():
            errors.append(f"{ctx}: 'source' must be a non-empty string")
        else:
            source_counts[source] += 1
            if "synthetic" not in source.lower():
                warnings.append(f"{ctx}: source '{source}' is not explicitly synthetic")

        if not isinstance(rec["reviewed"], bool):
            errors.append(f"{ctx}: 'reviewed' must be boolean")
        else:
            reviewed_counts[str(rec["reviewed"]).lower()] += 1
            if not rec["reviewed"]:
                warnings.append(f"{ctx}: unreviewed synthetic example (human review required before prod SFT)")

        if not isinstance(rec["review_notes"], str) or not rec["review_notes"].strip():
            errors.append(f"{ctx}: 'review_notes' must be a non-empty string")

        msg_errors = validate_messages_structure(
            rec["messages"], expect_end_role="assistant", context_label=ctx
        )
        errors.extend(msg_errors)
        if msg_errors:
            continue

        messages = rec["messages"]
        user_turns = extract_user_turns(messages)
        turn_counts.append(len(user_turns))

        conv_fp = extract_conversation_fingerprint(messages)
        if conv_fp in seen_conv_hashes:
            errors.append(
                f"{ctx}: duplicate dialogue matches '{seen_conv_hashes[conv_fp]}'"
            )
        else:
            seen_conv_hashes[conv_fp] = rec_id

        combined_user_fp = text_fingerprint(" || ".join(user_turns))
        if combined_user_fp in seen_prompt_hashes:
            errors.append(
                f"{ctx}: duplicate user prompt sequence matches '{seen_prompt_hashes[combined_user_fp]}'"
            )
        else:
            seen_prompt_hashes[combined_user_fp] = rec_id

        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        for a_idx, msg in enumerate(assistant_msgs):
            content = msg["content"]
            assistant_char_lengths.append(len(content))
            is_final = a_idx == len(assistant_msgs) - 1
            unsafe_issues = check_unsafe_assistant_reply(
                content, category, safety_level, is_final
            )
            if unsafe_issues:
                safety_hits.append({"id": rec_id, "issues": unsafe_issues})
                errors.append(f"{ctx}: unsafe/contradictory assistant claim: {unsafe_issues}")

        for msg in messages:
            pii = check_pii(msg["content"])
            if pii:
                pii_hits.append({"id": rec_id, "role": msg["role"], "pii": pii})
                errors.append(f"{ctx}: PII/secret detected in {msg['role']}: {pii}")

    # Deduplicate warning noise for unreviewed counts in summary while preserving accuracy
    unreviewed_count = reviewed_counts.get("false", 0)
    compact_warnings = [
        w for w in warnings if "unreviewed synthetic example" not in w
    ]
    if unreviewed_count > 0:
        compact_warnings.append(
            f"{dataset_name}: {unreviewed_count}/{len(records)} records have reviewed=false "
            "(allowed for synthetic seed/smoke tests; requires clinical/geriatric review before prod SFT)."
        )

    return {
        "dataset": dataset_name,
        "total_records": len(records),
        "single_turn_records": sum(1 for t in turn_counts if t == 1),
        "multi_turn_records": sum(1 for t in turn_counts if t > 1),
        "category_counts": {cat: category_counts.get(cat, 0) for cat in ALLOWED_CATEGORIES},
        "safety_level_counts": {lvl: safety_counts.get(lvl, 0) for lvl in ALLOWED_SAFETY_LEVELS},
        "source_counts": dict(source_counts),
        "reviewed_counts": dict(reviewed_counts),
        "assistant_char_length": {
            "min": min(assistant_char_lengths) if assistant_char_lengths else 0,
            "max": max(assistant_char_lengths) if assistant_char_lengths else 0,
            "avg": round(sum(assistant_char_lengths) / len(assistant_char_lengths), 1)
            if assistant_char_lengths
            else 0.0,
        },
        "pii_findings": pii_hits,
        "safety_findings": safety_hits,
        "errors": errors,
        "warnings": compact_warnings,
    }


def validate_eval_records(
    records: list[dict[str, Any]],
    dataset_name: str = "eval_benchmark",
) -> dict[str, Any]:
    """Validate held-out evaluation benchmark schema, categories, safety, and PII."""
    errors: list[str] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()
    seen_prompt_hashes: dict[str, str] = {}
    category_counts: Counter[str] = Counter()
    safety_counts: Counter[str] = Counter()
    pii_hits: list[dict[str, Any]] = []
    turn_counts: list[int] = []

    for idx, rec in enumerate(records, start=1):
        rec_id = str(rec.get("id", f"<missing-id-{idx}>"))
        ctx = f"{dataset_name}[{rec_id}]"

        missing = [f for f in EVAL_REQUIRED_FIELDS if f not in rec]
        if missing:
            errors.append(f"{ctx}: missing required fields: {missing}")
            continue

        if not isinstance(rec["id"], str) or not rec["id"].strip():
            errors.append(f"{ctx}: 'id' must be a non-empty string")
        elif rec["id"] in seen_ids:
            errors.append(f"{ctx}: duplicate id '{rec['id']}'")
        else:
            seen_ids.add(rec["id"])

        category = rec["category"]
        if category not in ALLOWED_CATEGORIES:
            errors.append(f"{ctx}: invalid category '{category}'")
        else:
            category_counts[category] += 1

        safety_level = rec["safety_level"]
        if safety_level not in ALLOWED_SAFETY_LEVELS:
            errors.append(f"{ctx}: invalid safety_level '{safety_level}'")
        else:
            safety_counts[safety_level] += 1

        if category == "emergency_situations" and safety_level not in {"high", "critical"}:
            errors.append(
                f"{ctx}: category 'emergency_situations' must have high/critical safety_level"
            )

        for list_field in ("expected_criteria", "must_include_signals", "forbidden_claims"):
            val = rec[list_field]
            if not isinstance(val, list) or not all(isinstance(x, str) and x.strip() for x in val):
                errors.append(f"{ctx}: '{list_field}' must be a list of non-empty strings")

        if not isinstance(rec["source"], str) or not rec["source"].strip():
            errors.append(f"{ctx}: 'source' must be a non-empty string")
        if not isinstance(rec["reviewed"], bool):
            errors.append(f"{ctx}: 'reviewed' must be boolean")

        msg_errors = validate_messages_structure(
            rec["prompt_messages"], expect_end_role="user", context_label=ctx
        )
        errors.extend(msg_errors)
        if msg_errors:
            continue

        user_turns = extract_user_turns(rec["prompt_messages"])
        turn_counts.append(len(user_turns))
        fp = text_fingerprint(" || ".join(user_turns))
        if fp in seen_prompt_hashes:
            errors.append(
                f"{ctx}: duplicate prompt matches '{seen_prompt_hashes[fp]}'"
            )
        else:
            seen_prompt_hashes[fp] = rec_id

        for msg in rec["prompt_messages"]:
            pii = check_pii(msg["content"])
            if pii:
                pii_hits.append({"id": rec_id, "role": msg["role"], "pii": pii})
                errors.append(f"{ctx}: PII/secret detected in prompt {msg['role']}: {pii}")

    reviewed_counts = {
        "true": sum(1 for r in records if r.get("reviewed") is True),
        "false": sum(1 for r in records if r.get("reviewed") is False),
    }
    unreviewed = reviewed_counts["false"]
    if unreviewed:
        warnings.append(
            f"{dataset_name}: {unreviewed}/{len(records)} eval prompts have reviewed=false."
        )

    return {
        "dataset": dataset_name,
        "total_records": len(records),
        "single_turn_records": sum(1 for t in turn_counts if t == 1),
        "multi_turn_records": sum(1 for t in turn_counts if t > 1),
        "category_counts": {cat: category_counts.get(cat, 0) for cat in ALLOWED_CATEGORIES},
        "safety_level_counts": {lvl: safety_counts.get(lvl, 0) for lvl in ALLOWED_SAFETY_LEVELS},
        "reviewed_counts": reviewed_counts,
        "pii_findings": pii_hits,
        "errors": errors,
        "warnings": warnings,
    }


def check_leakage(
    splits: dict[str, list[dict[str, Any]]],
    eval_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Verify zero ID, conversation, or user-turn overlap across splits and eval benchmark."""
    leakage_errors: list[str] = []

    def index_records(
        recs: list[dict[str, Any]], msg_key: str
    ) -> tuple[set[str], set[str], set[str]]:
        ids: set[str] = set()
        conv_fps: set[str] = set()
        user_fps: set[str] = set()
        for r in recs:
            if isinstance(r.get("id"), str):
                ids.add(r["id"])
            msgs = r.get(msg_key, [])
            if isinstance(msgs, list):
                conv_fps.add(extract_conversation_fingerprint(msgs))
                for turn in extract_user_turns(msgs):
                    user_fps.add(text_fingerprint(turn))
        return ids, conv_fps, user_fps

    split_indices = {
        name: index_records(recs, "messages") for name, recs in splits.items()
    }
    eval_ids, eval_conv_fps, eval_user_fps = index_records(
        eval_records, "prompt_messages"
    )

    split_names = list(split_indices.keys())
    pair_checks: dict[str, dict[str, int]] = {}

    for i in range(len(split_names)):
        for j in range(i + 1, len(split_names)):
            a, b = split_names[i], split_names[j]
            ids_a, conv_a, user_a = split_indices[a]
            ids_b, conv_b, user_b = split_indices[b]
            id_ov = len(ids_a & ids_b)
            conv_ov = len(conv_a & conv_b)
            user_ov = len(user_a & user_b)
            pair_key = f"{a}__vs__{b}"
            pair_checks[pair_key] = {
                "id_overlap": id_ov,
                "conversation_overlap": conv_ov,
                "user_turn_overlap": user_ov,
            }
            if id_ov or conv_ov or user_ov:
                leakage_errors.append(
                    f"Leakage detected between {a} and {b}: "
                    f"id={id_ov}, conv={conv_ov}, user_turn={user_ov}"
                )

    if eval_records:
        for name, (ids_s, conv_s, user_s) in split_indices.items():
            id_ov = len(ids_s & eval_ids)
            conv_ov = len(conv_s & eval_conv_fps)
            user_ov = len(user_s & eval_user_fps)
            pair_key = f"{name}__vs__eval_benchmark"
            pair_checks[pair_key] = {
                "id_overlap": id_ov,
                "conversation_overlap": conv_ov,
                "user_turn_overlap": user_ov,
            }
            if id_ov or conv_ov or user_ov:
                leakage_errors.append(
                    f"Leakage detected between {name} and eval_benchmark: "
                    f"id={id_ov}, conv={conv_ov}, user_turn={user_ov}"
                )

    return {
        "zero_leakage": len(leakage_errors) == 0,
        "pair_checks": pair_checks,
        "errors": leakage_errors,
    }


def render_markdown_report(report: dict[str, Any]) -> str:
    """Format validation findings as a concise Markdown quality report."""
    lines: list[str] = [
        "# Mimamori Companion AI — Dataset Quality Report",
        "",
        f"- **Generated (UTC)**: `{report['generated_at_utc']}`",
        f"- **Overall Status**: `{'PASSED' if report['passed'] else 'FAILED'}`",
        f"- **Total Errors**: `{len(report['errors'])}`",
        f"- **Total Warnings**: `{len(report['warnings'])}`",
        f"- **Zero Split/Benchmark Leakage**: `{report['leakage_check']['zero_leakage']}`",
        "",
        "## 1. Dataset Inventory & Turn Statistics",
        "",
        "| Dataset | Records | Single-Turn | Multi-Turn | Unreviewed (`reviewed=false`) | PII Hits | Safety Issues |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]

    for ds_key, ds in report["datasets"].items():
        unrev = ds.get("reviewed_counts", {}).get("false", 0)
        pii_count = len(ds.get("pii_findings", []))
        safety_count = len(ds.get("safety_findings", []))
        lines.append(
            f"| `{ds_key}` | {ds['total_records']} | {ds['single_turn_records']} | "
            f"{ds['multi_turn_records']} | {unrev} | {pii_count} | {safety_count} |"
        )

    lines.extend(["", "## 2. Category Coverage (8 Required Categories)", ""])
    header = "| Category | " + " | ".join(f"`{k}`" for k in report["datasets"]) + " |"
    sep = "|---|" + "|".join("---:" for _ in report["datasets"]) + "|"
    lines.extend([header, sep])
    for cat in ALLOWED_CATEGORIES:
        counts = " | ".join(
            str(ds["category_counts"].get(cat, 0)) for ds in report["datasets"].values()
        )
        lines.append(f"| `{cat}` | {counts} |")

    lines.extend(["", "## 3. Safety Level Distribution", ""])
    s_header = "| Safety Level | " + " | ".join(f"`{k}`" for k in report["datasets"]) + " |"
    s_sep = "|---|" + "|".join("---:" for _ in report["datasets"]) + "|"
    lines.extend([s_header, s_sep])
    for lvl in ALLOWED_SAFETY_LEVELS:
        counts = " | ".join(
            str(ds["safety_level_counts"].get(lvl, 0)) for ds in report["datasets"].values()
        )
        lines.append(f"| `{lvl}` | {counts} |")

    lines.extend(["", "## 4. Split & Eval Benchmark Leakage Checks", ""])
    for pair_key, stats in report["leakage_check"]["pair_checks"].items():
        lines.append(
            f"- `{pair_key}`: id_overlap={stats['id_overlap']}, "
            f"conversation_overlap={stats['conversation_overlap']}, "
            f"user_turn_overlap={stats['user_turn_overlap']}"
        )

    if report["warnings"]:
        lines.extend(["", "## 5. Warnings & Review Gates", ""])
        for w in report["warnings"]:
            lines.append(f"- {w}")

    if report["errors"]:
        lines.extend(["", "## 6. Validation Errors", ""])
        for err in report["errors"]:
            lines.append(f"- {err}")

    lines.append("")
    return "\n".join(lines)


def run_validation(
    raw_file: Path,
    processed_dir: Path,
    eval_file: Path,
    output_dir: Path,
    require_processed: bool = False,
) -> dict[str, Any]:
    """Run full validation pipeline and write JSON + Markdown quality reports."""
    all_errors: list[str] = []
    all_warnings: list[str] = []
    dataset_reports: dict[str, Any] = {}

    raw_records, raw_load_errs = load_jsonl(raw_file)
    all_errors.extend(raw_load_errs)
    raw_report = validate_chat_records(raw_records, "raw_seed")
    dataset_reports["raw_seed"] = raw_report
    all_errors.extend(raw_report["errors"])
    all_warnings.extend(raw_report["warnings"])

    missing_raw_cats = [
        c for c, cnt in raw_report["category_counts"].items() if cnt == 0
    ]
    if missing_raw_cats:
        all_errors.append(f"raw_seed missing required categories: {missing_raw_cats}")

    eval_records, eval_load_errs = load_jsonl(eval_file)
    all_errors.extend(eval_load_errs)
    eval_report = validate_eval_records(eval_records, "eval_benchmark")
    dataset_reports["eval_benchmark"] = eval_report
    all_errors.extend(eval_report["errors"])
    all_warnings.extend(eval_report["warnings"])

    missing_eval_cats = [
        c for c, cnt in eval_report["category_counts"].items() if cnt == 0
    ]
    if missing_eval_cats:
        all_errors.append(
            f"eval_benchmark missing required categories: {missing_eval_cats}"
        )

    split_records: dict[str, list[dict[str, Any]]] = {}
    for split_name in ("train", "val", "test"):
        split_path = processed_dir / f"{split_name}.jsonl"
        if split_path.exists():
            recs, load_errs = load_jsonl(split_path)
            all_errors.extend(load_errs)
            rep = validate_chat_records(recs, split_name)
            dataset_reports[split_name] = rep
            split_records[split_name] = recs
            all_errors.extend(rep["errors"])
            all_warnings.extend(rep["warnings"])
        elif require_processed:
            all_errors.append(f"Required processed split missing: {split_path}")
        else:
            all_warnings.append(
                f"Processed split not found yet (run prepare_dataset.py): {split_path}"
            )

    leakage_targets = dict(split_records)
    if not split_records:
        leakage_targets["raw_seed"] = raw_records
    leakage_report = check_leakage(leakage_targets, eval_records)
    all_errors.extend(leakage_report["errors"])

    # Also inspect raw_seed vs eval_benchmark: warn if excluded from splits, error if splits absent
    if split_records:
        raw_vs_eval = check_leakage({"raw_seed": raw_records}, eval_records)
        leakage_report["pair_checks"].update(raw_vs_eval["pair_checks"])
        for raw_err in raw_vs_eval["errors"]:
            all_warnings.append(
                f"Raw-vs-eval overlap detected (excluded from processed splits): {raw_err}"
            )

    report: dict[str, Any] = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "passed": len(all_errors) == 0,
        "datasets": dataset_reports,
        "leakage_check": leakage_report,
        "errors": all_errors,
        "warnings": all_warnings,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "dataset_quality_report.json"
    md_path = output_dir / "dataset_quality_report.md"
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    md_path.write_text(render_markdown_report(report), encoding="utf-8")
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Validate Mimamori Companion AI datasets and generate quality reports."
    )
    parser.add_argument(
        "--raw",
        type=Path,
        default=root / "datasets" / "raw" / "synthetic_companion_seed.jsonl",
        help="Path to raw JSONL seed dataset.",
    )
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=root / "datasets" / "processed",
        help="Directory containing train.jsonl, val.jsonl, test.jsonl.",
    )
    parser.add_argument(
        "--eval-file",
        type=Path,
        default=root / "datasets" / "evaluation" / "eval_benchmark.jsonl",
        help="Path to held-out evaluation benchmark JSONL.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=root / "outputs",
        help="Directory to write dataset_quality_report.json and .md.",
    )
    parser.add_argument(
        "--require-processed",
        action="store_true",
        help="Fail if processed train/val/test splits do not exist yet.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    report = run_validation(
        raw_file=args.raw,
        processed_dir=args.processed_dir,
        eval_file=args.eval_file,
        output_dir=args.output_dir,
        require_processed=args.require_processed,
    )
    print(
        json.dumps(
            {
                "passed": report["passed"],
                "errors": len(report["errors"]),
                "warnings": len(report["warnings"]),
                "zero_leakage": report["leakage_check"]["zero_leakage"],
                "counts": {
                    k: v["total_records"] for k, v in report["datasets"].items()
                },
            },
            ensure_ascii=False,
        )
    )
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
