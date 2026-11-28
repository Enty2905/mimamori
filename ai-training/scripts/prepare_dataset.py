#!/usr/bin/env python3
"""Prepare stratified train/val/test JSONL splits with zero eval-benchmark leakage."""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from validate_dataset import (  # noqa: E402
    extract_conversation_fingerprint,
    extract_user_turns,
    load_jsonl,
    run_validation,
    text_fingerprint,
)


def _compute_split_counts(
    total: int,
    val_ratio: float,
    test_ratio: float,
) -> tuple[int, int, int]:
    """Compute (n_train, n_val, n_test) per stratum, preserving coverage on small sets."""
    if total <= 1:
        return total, 0, 0
    if total == 2:
        return 1, 1, 0
    if total == 3:
        return 1, 1, 1

    n_val = max(1, round(total * val_ratio))
    n_test = max(1, round(total * test_ratio))
    if n_val + n_test >= total:
        n_val = 1
        n_test = 1
    n_train = total - n_val - n_test
    return n_train, n_val, n_test


def filter_eval_overlap(
    raw_records: list[dict[str, Any]],
    eval_records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Exclude any raw record whose ID, conversation, or user turns match eval benchmark."""
    eval_ids: set[str] = set()
    eval_convs: set[str] = set()
    eval_user_fps: set[str] = set()

    for rec in eval_records:
        if isinstance(rec.get("id"), str):
            eval_ids.add(rec["id"])
        msgs = rec.get("prompt_messages", [])
        if isinstance(msgs, list):
            eval_convs.add(extract_conversation_fingerprint(msgs))
            for ut in extract_user_turns(msgs):
                eval_user_fps.add(text_fingerprint(ut))

    kept: list[dict[str, Any]] = []
    excluded_ids: list[str] = []
    for rec in raw_records:
        rec_id = str(rec.get("id", ""))
        msgs = rec.get("messages", [])
        conv_fp = extract_conversation_fingerprint(msgs) if isinstance(msgs, list) else ""
        user_fps = (
            {text_fingerprint(ut) for ut in extract_user_turns(msgs)}
            if isinstance(msgs, list)
            else set()
        )
        if rec_id in eval_ids or conv_fp in eval_convs or (user_fps & eval_user_fps):
            excluded_ids.append(rec_id)
        else:
            kept.append(rec)

    return kept, excluded_ids


def stratified_split(
    records: list[dict[str, Any]],
    *,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Deterministically split records stratified by category."""
    rng = random.Random(seed)
    by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rec in records:
        by_category[str(rec.get("category", "unknown"))].append(rec)

    train: list[dict[str, Any]] = []
    val: list[dict[str, Any]] = []
    test: list[dict[str, Any]] = []

    for category in sorted(by_category):
        group = list(by_category[category])
        group.sort(key=lambda item: str(item.get("id", "")))
        rng.shuffle(group)

        n_train, n_val, n_test = _compute_split_counts(
            len(group), val_ratio=val_ratio, test_ratio=test_ratio
        )
        train.extend(group[:n_train])
        val.extend(group[n_train : n_train + n_val])
        test.extend(group[n_train + n_val : n_train + n_val + n_test])

    train.sort(key=lambda item: str(item.get("id", "")))
    val.sort(key=lambda item: str(item.get("id", "")))
    test.sort(key=lambda item: str(item.get("id", "")))
    return train, val, test


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for rec in records:
            handle.write(json.dumps(rec, ensure_ascii=False) + "\n")


def prepare_splits(
    raw_file: Path,
    eval_file: Path,
    processed_dir: Path,
    output_dir: Path,
    *,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> dict[str, Any]:
    """Run full preparation: load, exclude eval overlap, stratify split, write, validate."""
    raw_records, raw_errs = load_jsonl(raw_file)
    if raw_errs:
        raise ValueError(f"Failed loading raw dataset: {raw_errs}")

    eval_records, eval_errs = load_jsonl(eval_file)
    if eval_errs:
        raise ValueError(f"Failed loading eval benchmark: {eval_errs}")

    filtered_raw, excluded_ids = filter_eval_overlap(raw_records, eval_records)
    train, val, test = stratified_split(
        filtered_raw, val_ratio=val_ratio, test_ratio=test_ratio, seed=seed
    )

    write_jsonl(processed_dir / "train.jsonl", train)
    write_jsonl(processed_dir / "val.jsonl", val)
    write_jsonl(processed_dir / "test.jsonl", test)

    validation_report = run_validation(
        raw_file=raw_file,
        processed_dir=processed_dir,
        eval_file=eval_file,
        output_dir=output_dir,
        require_processed=True,
    )

    return {
        "raw_count": len(raw_records),
        "excluded_eval_overlap_ids": excluded_ids,
        "split_counts": {
            "train": len(train),
            "val": len(val),
            "test": len(test),
        },
        "validation_passed": validation_report["passed"],
        "zero_leakage": validation_report["leakage_check"]["zero_leakage"],
        "errors": validation_report["errors"],
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Prepare stratified train/val/test splits for Mimamori Companion AI."
    )
    parser.add_argument(
        "--raw",
        type=Path,
        default=root / "datasets" / "raw" / "synthetic_companion_seed.jsonl",
    )
    parser.add_argument(
        "--eval-file",
        type=Path,
        default=root / "datasets" / "evaluation" / "eval_benchmark.jsonl",
    )
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=root / "datasets" / "processed",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=root / "outputs",
    )
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    summary = prepare_splits(
        raw_file=args.raw,
        eval_file=args.eval_file,
        processed_dir=args.processed_dir,
        output_dir=args.output_dir,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
    )
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if summary["validation_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
