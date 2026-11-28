"""Deterministic pre-LLM and post-LLM safety detector independent of LLMs."""

from __future__ import annotations

import re
import time
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.core.logging import get_logger
from app.safety.policies import (
    ACCENTED_SELF_HARM_PATTERN,
    ACCENTED_STOP_MEDICATION_PATTERN,
    ACTIVE_CURRENT_OVERRIDE_MARKERS,
    ALCOHOL_MEDICATION_PATTERNS,
    BENIGN_EXCLUSION_PHRASES,
    CRITICAL_SOLO_WARNING_PHRASES,
    DIAGNOSIS_REQUEST_PATTERNS,
    DIAGNOSIS_REQUEST_PHRASES,
    EMERGENCY_RULES,
    EMERGENCY_SUBTYPE_PRIORITY,
    EMOTIONAL_DISTRESS_CONTEXT_RE,
    EXPIRED_MEDICATION_PATTERNS,
    FALSE_REASSURANCE_PHRASES,
    FOLK_REPLACEMENT_PATTERNS,
    FRAGMENTED_STT_DOSAGE_PATTERNS,
    HISTORICAL_TIME_MARKERS,
    HISTORICAL_TIME_PATTERNS,
    HYPOTHETICAL_CONDITIONAL_MARKERS,
    HYPOTHETICAL_QUESTION_MARKERS,
    HYPOTHETICAL_STRONG_MARKERS,
    INABILITY_EMERGENCY_PATTERNS,
    INABILITY_EMERGENCY_REGEXES,
    MEDICATION_STATUS_QUERY_PHRASES,
    MISSED_OR_UNCERTAIN_DOSE_PATTERNS,
    MODERATE_WARNING_SIGNS,
    MULTI_SYMPTOM_CRITICAL_PAIRS,
    NEGATION_MARKERS,
    NEW_MEDICATION_ADR_PATTERNS,
    PERIOPERATIVE_ANTICOAGULANT_PATTERNS,
    POST_LLM_ANTICOAGULANT_DAYS_RE,
    POST_LLM_ANTIHISTAMINE_RE,
    POST_LLM_APP_LOG_DEFINITIVE_PROOF_RE,
    POST_LLM_BANK_CARD_RE,
    POST_LLM_CCCD_RE,
    POST_LLM_COMMON_DRUG_NAMES_RE,
    POST_LLM_CONCRETE_STRENGTH_RE,
    POST_LLM_DIAGNOSIS_PATTERNS,
    POST_LLM_DIRECTIVE_MED_VERB_RE,
    POST_LLM_DOSAGE_PATTERNS,
    POST_LLM_EMERGENCY_DELAY_PATTERNS,
    POST_LLM_MEDICAL_CONTEXT_CUE_RE,
    POST_LLM_PILL_SPECULATION_PATTERNS,
    POST_LLM_PRIVACY_BULK_OR_INSURER_RE,
    POST_LLM_PRIVACY_CREDENTIAL_SOLICIT_RE,
    POST_LLM_PRIVACY_HASH_CONFUSION_RE,
    POST_LLM_PRIVACY_OTHER_USER_LEAK_RE,
    POST_LLM_PRIVACY_STORAGE_PROMISE_RE,
    POST_LLM_REVERSED_KINSHIP_RE,
    POST_LLM_TAKEN_CLAIM_PATTERNS,
    POST_LLM_THINK_TAG_RE,
    POST_LLM_TOXIC_HERBAL_RECIPE_RE,
    POST_LLM_TOXIC_POSITIVITY_RE,
    POST_LLM_UNSAFE_FIRST_AID_PATTERNS,
    POST_LLM_UNSUPPORTED_CAPABILITY_PATTERNS,
    POST_LLM_VN_PHONE_RE,
    PRESCRIPTION_DOSAGE_REQUEST_PATTERNS,
    PRESCRIPTION_DOSAGE_REQUEST_PHRASES,
    PRESCRIPTION_SHARING_PATTERNS,
    PREVENTIVE_OR_INFO_MARKERS,
    PRIVACY_BULK_EXPORT_PATTERNS,
    PRIVACY_FINANCIAL_SECRET_PATTERNS,
    PRIVACY_PASSWORD_LOOKUP_PATTERNS,
    PRIVACY_THIRD_PARTY_ACCESS_PATTERNS,
    RENAL_LAB_PRESCRIPTION_PATTERNS,
    SELF_HARM_CRISIS_PATTERNS,
    SPECIALIST_OVERRIDE_PATTERNS,
    TABLET_CRUSHING_PATTERNS,
    TELEPHONY_ACTION_REQUEST_PATTERNS,
    THYROID_IMAGING_DIAGNOSIS_PATTERNS,
    TOXIC_POISON_PATTERNS,
    UNIDENTIFIED_PILL_PATTERNS,
    UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS,
    KnowledgeBoundary,
    build_capability_honesty_response,
    build_diagnosis_refusal_response,
    build_dosage_refusal_response,
    build_emergency_response,
    build_emotional_support_safe_fallback,
    build_false_reassurance_replacement,
    build_missed_dose_response,
    build_new_medication_adr_response,
    build_output_hygiene_safe_fallback,
    build_privacy_response,
    build_self_harm_crisis_response,
    build_tablet_crushing_response,
    build_toxic_poison_response,
    build_unidentified_pill_response,
    build_unrecorded_medication_response,
    has_clause_local_negation,
    has_explicit_anti_delay_guard,
    normalize_safety_text,
    normalize_vietnamese,
    resolve_honorific,
)
from app.schemas.companion import PersonalContextPayload, RiskLevel

safety_logger = get_logger("mimamori.ai_service.safety")

_CLAUSE_SPLIT_RE = re.compile(
    r"[.!?;,\n]+|\b(?:nhung|tuy nhien|ma lai|con bay gio|con gio|con hien tai|hien tai thi|voi lai)\b"
)
_NEGATION_LINKER_PHRASES = frozenset(
    {
        "",
        "bi",
        "co",
        "thay",
        "con",
        "bi dau",
        "dau",
        "cam thay",
        "bi con",
        "dau hieu",
        "trieu chung",
        "hien tuong",
        "co dau hieu",
        "co trieu chung",
        "co cam giac",
        "hoi",
    }
)
_CLINICIAN_DIAGNOSIS_REPORT_RE = re.compile(
    r"\b(?:bac si|benh vien|phong kham|duoc|da duoc)\s+(?:da\s+|moi\s+)?chan doan\b"
)
_APP_LOG_INTERNAL_NEG_RE = re.compile(
    r"\b(?:khong phai|khong la|chua phai|khong dong nghia|khong the coi|khong coi la|chi phan anh|khong thay the)\b"
)


class ClauseContext(str, Enum):
    """5-state deterministic emergency clause context classification (priority 1 -> 5)."""

    ACTIVE_EMERGENCY = "ACTIVE_EMERGENCY"
    NEGATED_SYMPTOM = "NEGATED_SYMPTOM"
    HYPOTHETICAL_SCENARIO = "HYPOTHETICAL_SCENARIO"
    GENERAL_KNOWLEDGE_OR_PREVENTIVE = "GENERAL_KNOWLEDGE_OR_PREVENTIVE"
    HISTORICAL_EVENT = "HISTORICAL_EVENT"


@dataclass
class SafetyAssessment:
    """Result of deterministic pre-LLM or post-LLM safety evaluation.

    All 9 original fields and defaults are preserved verbatim for backward compatibility.
    New internal fields carry safe defaults to pass Pre-LLM context to Post-LLM without
    changing the public validate_output() signature.
    """

    safety_triggered: bool = False
    bypass_llm: bool = False
    risk_level: RiskLevel = "low"
    matched_categories: list[str] = field(default_factory=list)
    guardrail_flags: list[str] = field(default_factory=list)
    deterministic_reply: Optional[str] = None
    escalation_guidance: Optional[str] = None
    knowledge_boundary: Optional[str] = None
    has_unrecorded_medication_risk: bool = False
    # Optional internal H2.4.2 metadata (defaults preserve 100% backward compatibility)
    inferred_honorific: Optional[str] = None
    detected_domain: Optional[str] = None
    matched_rule_ids: list[str] = field(default_factory=list)
    emotional_distress_context: bool = False
    hypothetical_emergency_query: bool = False


class SafetyDetector:
    """Deterministic safety engine protecting against emergencies and medical/privacy/capability overreach."""

    @staticmethod
    def _phrase_pattern(phrase: str) -> re.Pattern[str]:
        escaped = re.escape(phrase)
        return re.compile(rf"(?<![a-z0-9_]){escaped}(?![a-z0-9_])")

    @staticmethod
    def _audit_log(
        *,
        stage: str,
        action: str,
        assessment: SafetyAssessment,
        start_perf: float,
    ) -> None:
        """Emit strictly PII-free metadata-only audit log (ZERO message, reply, or PII text)."""
        latency_ms = (time.perf_counter() - start_perf) * 1000.0
        safety_logger.info(
            "safety_audit | stage=%s action=%s risk_level=%s boundary=%s domain=%s "
            "categories=%s flags=%s rule_ids=%s latency_ms=%.2f",
            stage,
            action,
            assessment.risk_level,
            assessment.knowledge_boundary or "none",
            assessment.detected_domain or "none",
            ",".join(assessment.matched_categories) or "none",
            ",".join(assessment.guardrail_flags) or "none",
            ",".join(assessment.matched_rule_ids) or "none",
            latency_ms,
        )

    @staticmethod
    def _strip_benign_exclusions(normalized_clause: str) -> str:
        cleaned = normalized_clause
        for benign in BENIGN_EXCLUSION_PHRASES:
            cleaned = re.sub(rf"(?<![a-z0-9_]){re.escape(benign)}(?![a-z0-9_])", " ", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    @staticmethod
    def _is_negated_or_preventive(clause: str, match_start: int, all_symptom_phrases: set[str]) -> bool:
        """Check whether the matched symptom inside a clause is negated or purely preventive."""
        prefix = clause[:match_start].strip()
        if not prefix:
            return False

        for marker in PREVENTIVE_OR_INFO_MARKERS:
            if re.search(rf"(?<![a-z0-9_]){re.escape(marker)}(?![a-z0-9_])", prefix):
                return True

        tokens = prefix.split()
        recent_tokens: list[str] = []
        for tok in reversed(tokens[-7:]):
            if tok in {"dang", "lai", "tu", "dot", "ma", "nhung"} and recent_tokens:
                break
            recent_tokens.append(tok)
        recent_window = " ".join(reversed(recent_tokens))

        best_match: Optional[re.Match[str]] = None
        for neg in NEGATION_MARKERS:
            neg_re = re.compile(rf"(?<![a-z0-9_]){re.escape(neg)}(?![a-z0-9_])")
            for candidate in neg_re.finditer(recent_window):
                if best_match is None or (
                    candidate.end() > best_match.end()
                    or (
                        candidate.end() == best_match.end()
                        and (candidate.end() - candidate.start()) > (best_match.end() - best_match.start())
                    )
                ):
                    best_match = candidate

        if best_match is None:
            return False

        between = recent_window[best_match.end() :].strip()
        if between in _NEGATION_LINKER_PHRASES:
            return True
        coord_match = re.search(r"\b(?:hay|hoac|va|lan|voi|cung)\b", between)
        if coord_match:
            prior_segment = between[: coord_match.start()].strip()
            if any(sym in prior_segment for sym in all_symptom_phrases):
                return True
        return False

    @classmethod
    def _has_active_current_marker(cls, clause: str) -> bool:
        return any(cls._phrase_pattern(marker).search(clause) for marker in ACTIVE_CURRENT_OVERRIDE_MARKERS)

    @classmethod
    def _is_hypothetical_clause(cls, clause: str) -> bool:
        if cls._has_active_current_marker(clause):
            return False
        if any(cls._phrase_pattern(marker).search(clause) for marker in HYPOTHETICAL_STRONG_MARKERS):
            return True
        has_conditional = any(
            cls._phrase_pattern(marker).search(clause) for marker in HYPOTHETICAL_CONDITIONAL_MARKERS
        )
        has_question = any(
            cls._phrase_pattern(marker).search(clause) for marker in HYPOTHETICAL_QUESTION_MARKERS
        )
        return has_conditional and has_question

    @classmethod
    def _is_preventive_or_info_clause(cls, clause: str) -> bool:
        if cls._has_active_current_marker(clause):
            return False
        return any(cls._phrase_pattern(marker).search(clause) for marker in PREVENTIVE_OR_INFO_MARKERS)

    @classmethod
    def _is_historical_clause(cls, clause: str) -> bool:
        if cls._has_active_current_marker(clause):
            return False
        if any(cls._phrase_pattern(marker).search(clause) for marker in HISTORICAL_TIME_MARKERS):
            return True
        return any(pattern.search(clause) for pattern in HISTORICAL_TIME_PATTERNS)

    @classmethod
    def _classify_clause_context(cls, clause: str) -> ClauseContext:
        """Assign clause to one of the 5 emergency context states (EP-01..EP-02)."""
        if cls._has_active_current_marker(clause):
            return ClauseContext.ACTIVE_EMERGENCY
        if cls._is_hypothetical_clause(clause):
            return ClauseContext.HYPOTHETICAL_SCENARIO
        if cls._is_preventive_or_info_clause(clause):
            return ClauseContext.GENERAL_KNOWLEDGE_OR_PREVENTIVE
        if cls._is_historical_clause(clause):
            return ClauseContext.HISTORICAL_EVENT
        # Fail-safe default: any affirmative symptom not matching states 2-5 is ACTIVE_EMERGENCY.
        return ClauseContext.ACTIVE_EMERGENCY

    @staticmethod
    def _select_emergency_subtype(matched_categories: list[str]) -> str:
        cat_set = set(matched_categories)
        for category, sub_type in EMERGENCY_SUBTYPE_PRIORITY:
            if category in cat_set:
                return sub_type
        return "default"

    @classmethod
    def _evaluate_symptom_clauses(
        cls, normalized_text: str
    ) -> tuple[list[str], list[str], set[str], bool, bool]:
        """Return (matched_categories, matched_labels_vi, moderate_signs, historical_found, hypothetical_found)."""
        matched_categories: list[str] = []
        matched_labels: list[str] = []
        moderate_signs: set[str] = set()
        historical_signs_found = False
        hypothetical_found = False

        all_emergency_phrases: set[str] = {
            phrase for rule in EMERGENCY_RULES for phrase in rule.phrases
        }
        all_moderate_phrases: set[str] = {
            phrase for phrases in MODERATE_WARNING_SIGNS.values() for phrase in phrases
        }
        all_known_phrases = all_emergency_phrases | all_moderate_phrases

        clauses = [c.strip() for c in _CLAUSE_SPLIT_RE.split(normalized_text) if c.strip()]
        for raw_clause in clauses:
            clause = cls._strip_benign_exclusions(raw_clause)
            if not clause:
                continue

            clause_ctx = cls._classify_clause_context(clause)
            if clause_ctx == ClauseContext.HYPOTHETICAL_SCENARIO:
                hypothetical_found = True
                continue
            if clause_ctx == ClauseContext.GENERAL_KNOWLEDGE_OR_PREVENTIVE:
                continue

            is_historical = clause_ctx == ClauseContext.HISTORICAL_EVENT

            # 1) Explicit inability emergencies (phrase + flexible regex)
            for category, phrase in INABILITY_EMERGENCY_PATTERNS:
                if cls._phrase_pattern(phrase).search(clause):
                    if is_historical:
                        historical_signs_found = True
                    elif category not in matched_categories:
                        matched_categories.append(category)
                        rule_label = next(
                            (r.label_vi for r in EMERGENCY_RULES if r.category == category),
                            category,
                        )
                        matched_labels.append(rule_label)

            for category, pattern in INABILITY_EMERGENCY_REGEXES:
                if pattern.search(clause):
                    if is_historical:
                        historical_signs_found = True
                    elif category not in matched_categories:
                        matched_categories.append(category)
                        rule_label = next(
                            (r.label_vi for r in EMERGENCY_RULES if r.category == category),
                            category,
                        )
                        matched_labels.append(rule_label)

            # 2) Solo critical neurological emergencies (e.g., seizure)
            for category, phrase in CRITICAL_SOLO_WARNING_PHRASES:
                match = cls._phrase_pattern(phrase).search(clause)
                if match and not cls._is_negated_or_preventive(clause, match.start(), all_known_phrases):
                    if is_historical:
                        historical_signs_found = True
                    elif category not in matched_categories:
                        matched_categories.append(category)
                        matched_labels.append("co giật")

            # 3) All 14 emergency rule categories (phrases + flexible distance patterns)
            for rule in EMERGENCY_RULES:
                matched_here = False
                for phrase in rule.phrases:
                    match = cls._phrase_pattern(phrase).search(clause)
                    if match and not cls._is_negated_or_preventive(
                        clause, match.start(), all_known_phrases
                    ):
                        matched_here = True
                        break
                if not matched_here and rule.patterns:
                    for pat in rule.patterns:
                        match = pat.search(clause)
                        if match and not cls._is_negated_or_preventive(
                            clause, match.start(), all_known_phrases
                        ):
                            matched_here = True
                            break
                if matched_here:
                    if is_historical:
                        historical_signs_found = True
                    elif rule.category not in matched_categories:
                        matched_categories.append(rule.category)
                        matched_labels.append(rule.label_vi)

            # 4) Moderate warning signs for multi-symptom escalation
            for sign_key, phrases in MODERATE_WARNING_SIGNS.items():
                for phrase in phrases:
                    match = cls._phrase_pattern(phrase).search(clause)
                    if match and not cls._is_negated_or_preventive(
                        clause, match.start(), all_known_phrases
                    ):
                        if is_historical:
                            historical_signs_found = True
                        else:
                            moderate_signs.add(sign_key)
                        break

        # Evaluate cross-clause emergency regexes when non-historical & non-hypothetical active context exists
        # (e.g., ph-em-007 insulin injection in clause 1 + shaking/sweating/slurred speech in clause 2).
        non_exempt_clauses = [
            cls._strip_benign_exclusions(c.strip())
            for c in clauses
            if c.strip()
            and cls._classify_clause_context(cls._strip_benign_exclusions(c.strip()))
            == ClauseContext.ACTIVE_EMERGENCY
        ]
        active_joined = " ".join(c for c in non_exempt_clauses if c)
        if active_joined:
            for rule in EMERGENCY_RULES:
                if rule.category in matched_categories or not rule.patterns:
                    continue
                for pat in rule.patterns:
                    match = pat.search(active_joined)
                    if match and not cls._is_negated_or_preventive(
                        active_joined, match.start(), all_known_phrases
                    ):
                        matched_categories.append(rule.category)
                        matched_labels.append(rule.label_vi)
                        break

        # Evaluate multi-symptom critical combinations (EP-01: active moderate signs across active clauses)
        for combo in MULTI_SYMPTOM_CRITICAL_PAIRS:
            if combo.issubset(moderate_signs):
                if "multi_symptom_warning" not in matched_categories:
                    matched_categories.append("multi_symptom_warning")
                    matched_labels.append("nhiều triệu chứng cảnh báo cùng lúc")
                break

        return (
            matched_categories,
            matched_labels,
            moderate_signs,
            historical_signs_found,
            hypothetical_found,
        )

    @classmethod
    def _collect_affirmative_emergencies(
        cls, normalized_text: str
    ) -> tuple[list[str], list[str], set[str]]:
        """Backward-compatible helper returning (matched_categories, matched_labels_vi, moderate_signs)."""
        cats, labels, moderate_signs, _, _ = cls._evaluate_symptom_clauses(normalized_text)
        return cats, labels, moderate_signs

    @staticmethod
    def _extract_medication_status_lists(
        personal_context: Optional[PersonalContextPayload],
    ) -> tuple[list[str], list[str]]:
        """Return (taken_med_names, pending_or_missed_med_names) from minimal context."""
        if personal_context is None:
            return [], []

        taken: list[str] = []
        not_taken: list[str] = []
        if personal_context.medication_logs:
            for log in personal_context.medication_logs:
                if log.status == "TAKEN":
                    taken.append(log.medication_name)
                elif log.status in {"PENDING", "MISSED"}:
                    not_taken.append(log.medication_name)

        if not not_taken and personal_context.medication_schedules and not taken:
            for sched in personal_context.medication_schedules:
                not_taken.append(sched.medication_name)

        return taken, not_taken

    @staticmethod
    def _extract_grounded_med_tokens(
        personal_context: Optional[PersonalContextPayload],
    ) -> tuple[bool, set[str]]:
        """Return (has_schedule_or_log_data, normalized_schedule_and_log_strings) for TD-05 validation."""
        if personal_context is None:
            return False, set()

        grounded_strings: set[str] = set()
        if personal_context.medication_schedules:
            for sched in personal_context.medication_schedules:
                if sched.medication_name:
                    grounded_strings.add(normalize_safety_text(sched.medication_name, preserve_punctuation=False, with_accent_sentinels=False))
                if sched.dosage_amount:
                    grounded_strings.add(normalize_safety_text(sched.dosage_amount, preserve_punctuation=False, with_accent_sentinels=False))
                if sched.reminder_time:
                    grounded_strings.add(normalize_safety_text(sched.reminder_time, preserve_punctuation=False, with_accent_sentinels=False))
        if personal_context.medication_logs:
            for log in personal_context.medication_logs:
                if log.medication_name:
                    grounded_strings.add(normalize_safety_text(log.medication_name, preserve_punctuation=False, with_accent_sentinels=False))

        return bool(grounded_strings), grounded_strings

    @staticmethod
    def _is_grounded_in_context(token: str, grounded_strings: set[str]) -> bool:
        clean = token.strip().lower()
        return any(clean in entry for entry in grounded_strings)

    @staticmethod
    def _has_pre_negation_in_reply(reply_norm: str, match_start: int) -> bool:
        """Backward-compatible wrapper delegating to 4-layer clause-local negation."""
        return has_clause_local_negation(reply_norm, match_start)

    def evaluate_input(
        self,
        message: str,
        personal_context: Optional[PersonalContextPayload] = None,
    ) -> SafetyAssessment:
        """Run deterministic pre-LLM safety triage (Priority 0 -> 6)."""
        start_perf = time.perf_counter()
        raw_lower_nfc = unicodedata.normalize("NFC", message).lower() if message else ""
        norm = normalize_safety_text(message, preserve_punctuation=True, with_accent_sentinels=True)
        norm_flat = normalize_safety_text(message, preserve_punctuation=False, with_accent_sentinels=True)
        honorific = resolve_honorific(message, personal_context)
        is_emotional_distress = bool(EMOTIONAL_DISTRESS_CONTEXT_RE.search(norm_flat))

        # ------------------------------------------------------------------
        # Priority 0: Emergency 115 Protocol (TOP PRIORITY — NEVER OVERRIDDEN)
        # ------------------------------------------------------------------
        (
            emerg_cats,
            emerg_labels,
            moderate_signs,
            historical_signs_found,
            hypothetical_found,
        ) = self._evaluate_symptom_clauses(norm)

        if emerg_cats:
            sub_type = self._select_emergency_subtype(emerg_cats)
            reply, escalation = build_emergency_response(honorific, emerg_labels, sub_type=sub_type)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="critical",
                matched_categories=emerg_cats,
                guardrail_flags=["emergency_115_escalation"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.EMERGENCY_PROTOCOL.value,
                inferred_honorific=honorific,
                detected_domain="emergency",
                matched_rule_ids=[f"pre_emergency_{sub_type}"],
            )
            self._audit_log(stage="pre_llm", action="block_emergency", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 1A: Lethal Herbal Poison / Toxic Substances (ph-om-004)
        # ------------------------------------------------------------------
        if any(p.search(norm_flat) for p in TOXIC_POISON_PATTERNS):
            reply, escalation = build_toxic_poison_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="critical",
                matched_categories=["toxic_substance_or_herbal_poison"],
                guardrail_flags=["pre_llm_toxic_poison_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="toxic_poison",
                matched_rule_ids=["pre_toxic_herbal_poison"],
            )
            self._audit_log(stage="pre_llm", action="block_toxic_poison", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 1B: Self-Harm Crisis (ph-es-009)
        # ------------------------------------------------------------------
        if bool(ACCENTED_SELF_HARM_PATTERN.search(raw_lower_nfc)) or any(
            p.search(norm_flat) for p in SELF_HARM_CRISIS_PATTERNS
        ):
            reply, escalation = build_self_harm_crisis_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["self_harm_crisis"],
                guardrail_flags=["pre_llm_self_harm_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="self_harm",
                matched_rule_ids=["pre_self_harm_crisis"],
                emotional_distress_context=True,
            )
            self._audit_log(stage="pre_llm", action="block_self_harm", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 2: Privacy, PII, Impersonation & Credentials (ph-pr-001..005)
        # ------------------------------------------------------------------
        if any(p.search(norm_flat) for p in PRIVACY_BULK_EXPORT_PATTERNS):
            reply, escalation = build_privacy_response(honorific, variant="bulk_export")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="critical",
                matched_categories=["privacy_bulk_export_or_impersonation"],
                guardrail_flags=["pre_llm_privacy_guardrail", "privacy_bulk_export_blocked"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                inferred_honorific=honorific,
                detected_domain="privacy",
                matched_rule_ids=["pre_privacy_bulk_export"],
            )
            self._audit_log(stage="pre_llm", action="block_privacy", assessment=assessment, start_perf=start_perf)
            return assessment

        if any(p.search(norm_flat) for p in PRIVACY_FINANCIAL_SECRET_PATTERNS):
            reply, escalation = build_privacy_response(honorific, variant="financial_secret")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["privacy_financial_credential_input"],
                guardrail_flags=["pre_llm_privacy_guardrail", "privacy_financial_secret_blocked"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                inferred_honorific=honorific,
                detected_domain="privacy",
                matched_rule_ids=["pre_privacy_financial_secret"],
            )
            self._audit_log(stage="pre_llm", action="block_privacy", assessment=assessment, start_perf=start_perf)
            return assessment

        if any(p.search(norm_flat) for p in PRIVACY_PASSWORD_LOOKUP_PATTERNS):
            reply, escalation = build_privacy_response(honorific, variant="password_bcrypt")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["privacy_password_or_credential_lookup"],
                guardrail_flags=["pre_llm_privacy_guardrail", "privacy_password_blocked"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                inferred_honorific=honorific,
                detected_domain="privacy",
                matched_rule_ids=["pre_privacy_password_bcrypt"],
            )
            self._audit_log(stage="pre_llm", action="block_privacy", assessment=assessment, start_perf=start_perf)
            return assessment

        if any(p.search(norm_flat) for p in PRIVACY_THIRD_PARTY_ACCESS_PATTERNS):
            reply, escalation = build_privacy_response(honorific, variant="third_party")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["privacy_third_party_access"],
                guardrail_flags=["pre_llm_privacy_guardrail", "privacy_third_party_blocked"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                inferred_honorific=honorific,
                detected_domain="privacy",
                matched_rule_ids=["pre_privacy_third_party"],
            )
            self._audit_log(stage="pre_llm", action="block_privacy", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 3: Medication Safety (STRICT INTERNAL ORDER 3.1 -> 3.6)
        # ------------------------------------------------------------------
        # 3.1 New-medication ADR (ph-ms-009) — MUST run BEFORE generic dosage refusal!
        if any(p.search(norm_flat) for p in NEW_MEDICATION_ADR_PATTERNS):
            reply, escalation = build_new_medication_adr_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["new_medication_adr"],
                guardrail_flags=["pre_llm_new_medication_adr_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medication_adr",
                matched_rule_ids=["pre_med_new_adr"],
            )
            self._audit_log(stage="pre_llm", action="block_medication_adr", assessment=assessment, start_perf=start_perf)
            return assessment

        # 3.2 Unidentified pill / unmarked blister / fragmented STT (ph-ms-001, ph-ia-001/003/006/007/009)
        if any(p.search(norm) for p in FRAGMENTED_STT_DOSAGE_PATTERNS):
            reply, escalation = build_unidentified_pill_response(honorific, fragmented_stt=True)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["ambiguous_fragmented_dosage_query"],
                guardrail_flags=["pre_llm_unidentified_pill_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medication_pill_id",
                matched_rule_ids=["pre_med_fragmented_stt"],
            )
            self._audit_log(stage="pre_llm", action="block_pill_id", assessment=assessment, start_perf=start_perf)
            return assessment

        if any(p.search(norm_flat) for p in UNIDENTIFIED_PILL_PATTERNS):
            reply, escalation = build_unidentified_pill_response(honorific, fragmented_stt=False)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["unidentified_medication_appearance"],
                guardrail_flags=["pre_llm_unidentified_pill_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medication_pill_id",
                matched_rule_ids=["pre_med_unidentified_pill"],
            )
            self._audit_log(stage="pre_llm", action="block_pill_id", assessment=assessment, start_perf=start_perf)
            return assessment

        # 3.3 Tablet crushing / splitting (ph-ms-006)
        if any(p.search(norm_flat) for p in TABLET_CRUSHING_PATTERNS):
            reply, escalation = build_tablet_crushing_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["tablet_crushing_check"],
                guardrail_flags=["pre_llm_tablet_crushing_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medication_safety",
                matched_rule_ids=["pre_med_tablet_crushing"],
            )
            self._audit_log(stage="pre_llm", action="block_medication", assessment=assessment, start_perf=start_perf)
            return assessment

        # 3.4 Missed or uncertain dose / doubling (ph-ms-002, ph-ms-003)
        if any(p.search(norm_flat) for p in MISSED_OR_UNCERTAIN_DOSE_PATTERNS):
            reply, escalation = build_missed_dose_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["missed_or_uncertain_dose"],
                guardrail_flags=["pre_llm_missed_dose_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                has_unrecorded_medication_risk=True,
                inferred_honorific=honorific,
                detected_domain="medication_safety",
                matched_rule_ids=["pre_med_missed_dose"],
            )
            self._audit_log(stage="pre_llm", action="block_medication", assessment=assessment, start_perf=start_perf)
            return assessment

        # 3.5 Specialized medication refusals (expired, sharing, alcohol, anticoagulant, renal lab, folk)
        specialized_med_checks: tuple[tuple[str, str, tuple[re.Pattern[str], ...]], ...] = (
            ("expired_medication", "expired", EXPIRED_MEDICATION_PATTERNS),
            ("prescription_sharing", "sharing", PRESCRIPTION_SHARING_PATTERNS),
            ("alcohol_medication_interaction", "alcohol", ALCOHOL_MEDICATION_PATTERNS),
            ("perioperative_anticoagulant", "anticoagulant", PERIOPERATIVE_ANTICOAGULANT_PATTERNS),
            ("renal_lab_prescription", "renal_lab", RENAL_LAB_PRESCRIPTION_PATTERNS),
            ("folk_medication_replacement", "folk_replacement", FOLK_REPLACEMENT_PATTERNS),
        )
        for cat_name, variant, patterns in specialized_med_checks:
            if any(p.search(norm_flat) for p in patterns):
                reply, escalation = build_dosage_refusal_response(honorific, variant=variant)
                assessment = SafetyAssessment(
                    safety_triggered=True,
                    bypass_llm=True,
                    risk_level="high",
                    matched_categories=[cat_name],
                    guardrail_flags=["pre_llm_dosage_guardrail", f"pre_llm_{cat_name}"],
                    deterministic_reply=reply,
                    escalation_guidance=escalation,
                    knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    inferred_honorific=honorific,
                    detected_domain="medication_safety",
                    matched_rule_ids=[f"pre_med_{variant}"],
                )
                self._audit_log(stage="pre_llm", action="block_medication", assessment=assessment, start_perf=start_perf)
                return assessment

        # 3.6 Generic prescription / dosage modification refusal (ph-ms-005/013/015, existing tests)
        is_schedule_lookup = bool(re.search(r"\b(?:lich|gio)\s+uong\s+thuoc\b", norm_flat))
        has_dosage_request = (
            bool(ACCENTED_STOP_MEDICATION_PATTERN.search(raw_lower_nfc))
            or any(
                self._phrase_pattern(p).search(norm_flat)
                for p in PRESCRIPTION_DOSAGE_REQUEST_PHRASES
                if not (p == "uong thuoc gi" and is_schedule_lookup)
            )
            or any(pattern.search(norm_flat) for pattern in PRESCRIPTION_DOSAGE_REQUEST_PATTERNS)
        )
        if has_dosage_request:
            reply, escalation = build_dosage_refusal_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["prescription_or_dosage_change"],
                guardrail_flags=["pre_llm_dosage_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medication_safety",
                matched_rule_ids=["pre_med_dosage_generic"],
            )
            self._audit_log(stage="pre_llm", action="block_medication", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 4: Out-of-Scope Diagnosis & Specialist Override (ph-om-001, ph-om-005)
        # ------------------------------------------------------------------
        if any(p.search(norm_flat) for p in THYROID_IMAGING_DIAGNOSIS_PATTERNS):
            reply, escalation = build_diagnosis_refusal_response(honorific, variant="thyroid_imaging")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["diagnosis_request", "thyroid_imaging_interpretation"],
                guardrail_flags=["pre_llm_diagnosis_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medical_diagnosis",
                matched_rule_ids=["pre_diag_thyroid_imaging"],
            )
            self._audit_log(stage="pre_llm", action="block_diagnosis", assessment=assessment, start_perf=start_perf)
            return assessment

        if any(p.search(norm_flat) for p in SPECIALIST_OVERRIDE_PATTERNS):
            reply, escalation = build_diagnosis_refusal_response(honorific, variant="specialist_override")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["specialist_procedure_override"],
                guardrail_flags=["pre_llm_diagnosis_guardrail", "pre_llm_specialist_override"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medical_diagnosis",
                matched_rule_ids=["pre_diag_specialist_override"],
            )
            self._audit_log(stage="pre_llm", action="block_diagnosis", assessment=assessment, start_perf=start_perf)
            return assessment

        is_clinician_report = bool(_CLINICIAN_DIAGNOSIS_REPORT_RE.search(norm_flat))
        has_diagnosis_phrase = any(
            self._phrase_pattern(p).search(norm_flat)
            for p in DIAGNOSIS_REQUEST_PHRASES
            if not (p == "chan doan" and is_clinician_report)
        )
        has_diagnosis_request = has_diagnosis_phrase or any(
            pattern.search(norm_flat) for pattern in DIAGNOSIS_REQUEST_PATTERNS
        )
        if has_diagnosis_request:
            reply, escalation = build_diagnosis_refusal_response(honorific)
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["diagnosis_request"],
                guardrail_flags=["pre_llm_diagnosis_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                inferred_honorific=honorific,
                detected_domain="medical_diagnosis",
                matched_rule_ids=["pre_diag_generic"],
            )
            self._audit_log(stage="pre_llm", action="block_diagnosis", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 5: Capability Honesty — Telephony (ph-es-003) & DB Medication Mark (ph-ms-012)
        # ------------------------------------------------------------------
        if any(p.search(norm_flat) for p in TELEPHONY_ACTION_REQUEST_PATTERNS):
            reply, escalation = build_capability_honesty_response(honorific, variant="telephony")
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="moderate",
                matched_categories=["unsupported_telephony_request"],
                guardrail_flags=["pre_llm_capability_honesty_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.CAPABILITY_BOUNDARY.value,
                inferred_honorific=honorific,
                detected_domain="capability_honesty",
                matched_rule_ids=["pre_cap_telephony"],
                emotional_distress_context=is_emotional_distress,
            )
            self._audit_log(stage="pre_llm", action="block_capability", assessment=assessment, start_perf=start_perf)
            return assessment

        taken_meds, not_taken_meds = self._extract_medication_status_lists(personal_context)
        asks_to_mark_taken = any(
            p.search(norm_flat) for p in UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS
        )
        asks_med_status = any(
            self._phrase_pattern(p).search(norm_flat) for p in MEDICATION_STATUS_QUERY_PHRASES
        )
        if asks_to_mark_taken:
            reply, escalation = build_unrecorded_medication_response(
                honorific, taken_meds, not_taken_meds
            )
            assessment = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="moderate",
                matched_categories=["unrecorded_medication_intake"],
                guardrail_flags=["pre_llm_unrecorded_medication_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                has_unrecorded_medication_risk=True,
                inferred_honorific=honorific,
                detected_domain="capability_honesty",
                matched_rule_ids=["pre_cap_mark_medication_taken"],
            )
            self._audit_log(stage="pre_llm", action="block_medication_mark", assessment=assessment, start_perf=start_perf)
            return assessment

        # ------------------------------------------------------------------
        # Priority 6: Allow to RAG/LLM with Risk & Context Flags
        # ------------------------------------------------------------------
        risk_level: RiskLevel = (
            "moderate" if moderate_signs or historical_signs_found or asks_med_status else "low"
        )
        flags: list[str] = []
        if moderate_signs:
            flags.append("moderate_symptom_monitoring")
        if historical_signs_found:
            flags.append("historical_symptom_context")
        if asks_med_status:
            flags.append("medication_adherence_check")
        if hypothetical_found:
            flags.append("hypothetical_emergency_query")

        categories = sorted(moderate_signs)
        if historical_signs_found:
            categories.append("historical_symptom")

        assessment = SafetyAssessment(
            safety_triggered=False,
            bypass_llm=False,
            risk_level=risk_level,
            matched_categories=categories,
            guardrail_flags=flags,
            has_unrecorded_medication_risk=(asks_med_status or not taken_meds),
            inferred_honorific=honorific,
            emotional_distress_context=is_emotional_distress,
            hypothetical_emergency_query=hypothetical_found,
        )
        self._audit_log(stage="pre_llm", action="allow", assessment=assessment, start_perf=start_perf)
        return assessment

    def validate_output(
        self,
        reply_text: str,
        pre_assessment: SafetyAssessment,
        personal_context: Optional[PersonalContextPayload] = None,
    ) -> SafetyAssessment:
        """Post-LLM deterministic guardrail: STRICT block-or-safe-replace (never log-only)."""
        start_perf = time.perf_counter()
        raw = reply_text or ""
        norm_sentinels = normalize_safety_text(raw, preserve_punctuation=True, with_accent_sentinels=True)
        norm_flat = normalize_safety_text(raw, preserve_punctuation=False, with_accent_sentinels=False)

        honorific = (
            (personal_context.preferred_honorific if personal_context and personal_context.preferred_honorific else None)
            or pre_assessment.inferred_honorific
            or "ông/bà"
        )
        pre_flags = list(pre_assessment.guardrail_flags)

        def _block(
            *,
            risk_level: RiskLevel,
            categories: list[str],
            added_flags: list[str],
            reply: str,
            escalation: str,
            boundary: str,
            domain: str,
            rule_id: str,
        ) -> SafetyAssessment:
            result = SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level=risk_level,
                matched_categories=categories,
                guardrail_flags=[*pre_flags, *added_flags],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=boundary,
                inferred_honorific=honorific,
                detected_domain=domain,
                matched_rule_ids=[rule_id],
            )
            self._audit_log(stage="post_llm", action="block_replace", assessment=result, start_perf=start_perf)
            return result

        # ------------------------------------------------------------------
        # 1) Output Hygiene: <think> tag leak (always block & safe replace)
        # ------------------------------------------------------------------
        if POST_LLM_THINK_TAG_RE.search(raw):
            is_emerg_ctx = pre_assessment.risk_level == "critical" or bool(
                POST_LLM_MEDICAL_CONTEXT_CUE_RE.search(norm_flat) and "115" in norm_flat
            )
            safe_reply, escalation = build_output_hygiene_safe_fallback(
                honorific, is_emergency_context=is_emerg_ctx
            )
            return _block(
                risk_level="critical" if is_emerg_ctx else "moderate",
                categories=["post_llm_think_tag_leak"],
                added_flags=["post_llm_think_tag_blocked"],
                reply=safe_reply,
                escalation=escalation,
                boundary=(
                    KnowledgeBoundary.EMERGENCY_PROTOCOL.value
                    if is_emerg_ctx
                    else KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value
                ),
                domain="output_hygiene",
                rule_id="post_think_tag",
            )

        # ------------------------------------------------------------------
        # 2) Global Emergency Delay & 12 Unsafe First-Aid Maneuvers
        #    (Runs REGARDLESS of pre_assessment.risk_level; '115' NEVER excuses!)
        # ------------------------------------------------------------------
        for code, sub_type, pattern in POST_LLM_UNSAFE_FIRST_AID_PATTERNS:
            for match in pattern.finditer(norm_sentinels):
                if not has_clause_local_negation(norm_sentinels, match.start()):
                    safe_reply, escalation = build_emergency_response(
                        honorific, [], sub_type=sub_type
                    )
                    return _block(
                        risk_level="critical",
                        categories=["post_llm_unsafe_first_aid", code],
                        added_flags=["post_llm_unsafe_first_aid_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.EMERGENCY_PROTOCOL.value,
                        domain="emergency",
                        rule_id=f"post_first_aid_{code}",
                    )

        has_medical_cue = bool(POST_LLM_MEDICAL_CONTEXT_CUE_RE.search(norm_flat)) or (
            pre_assessment.risk_level in {"moderate", "high", "critical"}
        )
        for code, pattern in POST_LLM_EMERGENCY_DELAY_PATTERNS:
            if code == "watchful_waiting_after_minutes" and not has_medical_cue:
                continue
            for match in pattern.finditer(norm_sentinels):
                if not has_explicit_anti_delay_guard(
                    norm_sentinels, match.start(), pattern_code=code
                ):
                    sub_type = "chest_pain" if "nguc" in norm_flat else "default"
                    safe_reply, escalation = build_emergency_response(
                        honorific, [], sub_type=sub_type
                    )
                    return _block(
                        risk_level="critical",
                        categories=["post_llm_emergency_delay", code],
                        added_flags=["post_llm_emergency_delay_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.EMERGENCY_PROTOCOL.value,
                        domain="emergency",
                        rule_id=f"post_delay_{code}",
                    )

        # ------------------------------------------------------------------
        # 3) Privacy, Raw PII Digits, Impersonation & BCrypt Confusion (Global)
        # ------------------------------------------------------------------
        if POST_LLM_VN_PHONE_RE.search(raw) or POST_LLM_CCCD_RE.search(raw) or POST_LLM_BANK_CARD_RE.search(raw):
            safe_reply, escalation = build_privacy_response(honorific, variant="third_party")
            return _block(
                risk_level="critical",
                categories=["post_llm_pii_leak"],
                added_flags=["post_llm_privacy_pii_blocked"],
                reply=safe_reply,
                escalation=escalation,
                boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                domain="privacy",
                rule_id="post_privacy_pii_digits",
            )

        for match in POST_LLM_PRIVACY_BULK_OR_INSURER_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_privacy_response(honorific, variant="bulk_export")
                return _block(
                    risk_level="critical",
                    categories=["post_llm_privacy_impersonation"],
                    added_flags=["post_llm_privacy_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                    domain="privacy",
                    rule_id="post_privacy_bulk_insurer",
                )

        for pat, rule_id in (
            (POST_LLM_PRIVACY_CREDENTIAL_SOLICIT_RE, "post_privacy_credential_solicit"),
            (POST_LLM_PRIVACY_STORAGE_PROMISE_RE, "post_privacy_storage_promise"),
        ):
            for match in pat.finditer(norm_sentinels):
                if not has_clause_local_negation(norm_sentinels, match.start()):
                    safe_reply, escalation = build_privacy_response(honorific, variant="financial_secret")
                    return _block(
                        risk_level="high",
                        categories=["post_llm_privacy_credential_violation"],
                        added_flags=["post_llm_privacy_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                        domain="privacy",
                        rule_id=rule_id,
                    )

        for match in POST_LLM_PRIVACY_OTHER_USER_LEAK_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_privacy_response(honorific, variant="third_party")
                return _block(
                    risk_level="high",
                    categories=["post_llm_privacy_other_user_leak"],
                    added_flags=["post_llm_privacy_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                    domain="privacy",
                    rule_id="post_privacy_other_user",
                )

        for match in POST_LLM_PRIVACY_HASH_CONFUSION_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_privacy_response(honorific, variant="password_bcrypt")
                return _block(
                    risk_level="high",
                    categories=["post_llm_privacy_hash_confusion"],
                    added_flags=["post_llm_privacy_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.PRIVACY_BOUNDARY.value,
                    domain="privacy",
                    rule_id="post_privacy_bcrypt_confusion",
                )

        # ------------------------------------------------------------------
        # 4) Unsupported Capability / Action-Success Claims (ALL 8 Families)
        #    Note: verified_execution_receipt is NOT_SUPPORTED (always False in H2.4.2).
        # ------------------------------------------------------------------
        for code, cap_variant, pattern in POST_LLM_UNSUPPORTED_CAPABILITY_PATTERNS:
            for match in pattern.finditer(norm_sentinels):
                if not has_clause_local_negation(norm_sentinels, match.start()):
                    if cap_variant == "medication_log":
                        taken_meds, not_taken_meds = self._extract_medication_status_lists(personal_context)
                        safe_reply, escalation = build_unrecorded_medication_response(
                            honorific, taken_meds, not_taken_meds
                        )
                        return _block(
                            risk_level="moderate",
                            categories=["post_llm_unsupported_capability", code],
                            added_flags=[
                                "post_llm_capability_claim_blocked",
                                "post_llm_unrecorded_medication_blocked",
                            ],
                            reply=safe_reply,
                            escalation=escalation,
                            boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                            domain="capability_honesty",
                            rule_id=f"post_cap_{code}",
                        )
                    safe_reply, escalation = build_capability_honesty_response(
                        honorific, variant=cap_variant
                    )
                    return _block(
                        risk_level="high" if code == "false_auto_115_dispatch_claim" else "moderate",
                        categories=["post_llm_unsupported_capability", code],
                        added_flags=["post_llm_capability_claim_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.CAPABILITY_BOUNDARY.value,
                        domain="capability_honesty",
                        rule_id=f"post_cap_{code}",
                    )

        # ------------------------------------------------------------------
        # 5) Lethal Herbal Poison Recipe (ph-om-004)
        # ------------------------------------------------------------------
        for match in POST_LLM_TOXIC_HERBAL_RECIPE_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_toxic_poison_response(honorific)
                return _block(
                    risk_level="critical",
                    categories=["post_llm_toxic_herbal_recipe"],
                    added_flags=["post_llm_toxic_poison_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="toxic_poison",
                    rule_id="post_toxic_herbal_recipe",
                )

        # ------------------------------------------------------------------
        # 6) Diagnostic Claims & Specialist Override
        # ------------------------------------------------------------------
        for pattern in POST_LLM_DIAGNOSIS_PATTERNS:
            for match in pattern.finditer(norm_sentinels):
                if not has_clause_local_negation(norm_sentinels, match.start()):
                    safe_reply, escalation = build_diagnosis_refusal_response(honorific)
                    return _block(
                        risk_level="high",
                        categories=["post_llm_diagnosis_claim"],
                        added_flags=["post_llm_diagnosis_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                        domain="medical_diagnosis",
                        rule_id="post_diagnosis_claim",
                    )

        # ------------------------------------------------------------------
        # 7) Medication Safety: Antihistamine, Anticoagulant Days, Pill Speculation,
        #    Dosage Instructions & TD-05 Fail-Closed Schedule Provenance
        # ------------------------------------------------------------------
        for match in POST_LLM_ANTIHISTAMINE_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_new_medication_adr_response(honorific)
                return _block(
                    risk_level="high",
                    categories=["post_llm_antihistamine_suggestion"],
                    added_flags=["post_llm_dosage_blocked", "post_llm_antihistamine_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="medication_adr",
                    rule_id="post_med_antihistamine",
                )

        for match in POST_LLM_ANTICOAGULANT_DAYS_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_dosage_refusal_response(honorific, variant="anticoagulant")
                return _block(
                    risk_level="high",
                    categories=["post_llm_anticoagulant_days_claim"],
                    added_flags=["post_llm_dosage_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="medication_safety",
                    rule_id="post_med_anticoagulant_days",
                )

        for pattern in POST_LLM_PILL_SPECULATION_PATTERNS:
            for match in pattern.finditer(norm_sentinels):
                if not has_clause_local_negation(norm_sentinels, match.start()):
                    safe_reply, escalation = build_unidentified_pill_response(honorific)
                    return _block(
                        risk_level="high",
                        categories=["post_llm_pill_speculation"],
                        added_flags=["post_llm_pill_speculation_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                        domain="medication_pill_id",
                        rule_id="post_med_pill_speculation",
                    )

        # Actionable dosage / modification / prescribing patterns (4-layer negation aware)
        for pattern in POST_LLM_DOSAGE_PATTERNS:
            for match in pattern.finditer(norm_sentinels):
                if not has_clause_local_negation(norm_sentinels, match.start()):
                    safe_reply, escalation = build_dosage_refusal_response(honorific)
                    return _block(
                        risk_level="high",
                        categories=["post_llm_dosage_claim"],
                        added_flags=["post_llm_dosage_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                        domain="medication_safety",
                        rule_id="post_med_dosage_claim",
                    )

        # TD-05 Fail-Closed Schedule Provenance Check:
        # Block concrete drug names or mg/ml strengths unless grounded in personal_context
        # AND purely descriptive (no directive verbs).
        has_grounded_context, grounded_strings = self._extract_grounded_med_tokens(personal_context)
        for match in POST_LLM_COMMON_DRUG_NAMES_RE.finditer(norm_sentinels):
            if has_clause_local_negation(norm_sentinels, match.start()):
                continue
            drug_name = match.group(0)
            is_grounded = has_grounded_context and self._is_grounded_in_context(drug_name, grounded_strings)
            clause_window = norm_sentinels[max(0, match.start() - 40) : min(len(norm_sentinels), match.end() + 40)]
            has_directive = bool(POST_LLM_DIRECTIVE_MED_VERB_RE.search(clause_window))
            if (not is_grounded) or has_directive:
                safe_reply, escalation = build_dosage_refusal_response(honorific)
                return _block(
                    risk_level="high",
                    categories=["post_llm_ungrounded_medication_claim"],
                    added_flags=["post_llm_dosage_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="medication_safety",
                    rule_id="post_med_fail_closed_drug_name",
                )

        for match in POST_LLM_CONCRETE_STRENGTH_RE.finditer(norm_sentinels):
            if has_clause_local_negation(norm_sentinels, match.start()):
                continue
            strength_str = match.group(0)
            is_grounded = has_grounded_context and self._is_grounded_in_context(strength_str, grounded_strings)
            clause_window = norm_sentinels[max(0, match.start() - 40) : min(len(norm_sentinels), match.end() + 40)]
            has_directive = bool(POST_LLM_DIRECTIVE_MED_VERB_RE.search(clause_window))
            if (not is_grounded) or has_directive:
                safe_reply, escalation = build_dosage_refusal_response(honorific)
                return _block(
                    risk_level="high",
                    categories=["post_llm_ungrounded_dosage_strength"],
                    added_flags=["post_llm_dosage_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="medication_safety",
                    rule_id="post_med_fail_closed_strength",
                )

        # ------------------------------------------------------------------
        # 8) App Log Definitive Physical Proof & Unrecorded Intake Claims
        # ------------------------------------------------------------------
        for match in POST_LLM_APP_LOG_DEFINITIVE_PROOF_RE.finditer(norm_sentinels):
            if _APP_LOG_INTERNAL_NEG_RE.search(match.group(0)):
                continue
            if not has_clause_local_negation(norm_sentinels, match.start()):
                safe_reply, escalation = build_missed_dose_response(honorific)
                return _block(
                    risk_level="high",
                    categories=["post_llm_app_log_physical_proof"],
                    added_flags=["post_llm_unrecorded_medication_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="medication_safety",
                    rule_id="post_med_app_log_proof",
                )

        taken_meds, not_taken_meds = self._extract_medication_status_lists(personal_context)
        taken_norm = {normalize_vietnamese(name) for name in taken_meds}
        not_taken_norm = {normalize_vietnamese(name) for name in not_taken_meds}

        for pattern in POST_LLM_TAKEN_CLAIM_PATTERNS:
            for match in pattern.finditer(norm_sentinels):
                if has_clause_local_negation(norm_sentinels, match.start()):
                    continue
                snippet = norm_sentinels[max(0, match.start() - 20) : min(len(norm_sentinels), match.end() + 45)]
                mentions_unrecorded_med = any(med and med in snippet for med in not_taken_norm)
                mentions_taken_med = any(med and med in snippet for med in taken_norm)
                if not taken_norm or (mentions_unrecorded_med and not mentions_taken_med):
                    safe_reply, escalation = build_unrecorded_medication_response(
                        honorific, taken_meds, not_taken_meds
                    )
                    return _block(
                        risk_level="moderate",
                        categories=["unrecorded_medication_claim"],
                        added_flags=["post_llm_unrecorded_medication_blocked"],
                        reply=safe_reply,
                        escalation=escalation,
                        boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                        domain="medication_safety",
                        rule_id="post_med_unrecorded_taken",
                    )

        # ------------------------------------------------------------------
        # 9) False Reassurance (Global when risk elevated OR reply mentions symptoms)
        # ------------------------------------------------------------------
        if has_medical_cue:
            for phrase in FALSE_REASSURANCE_PHRASES:
                for match in self._phrase_pattern(phrase).finditer(norm_sentinels):
                    if not has_clause_local_negation(norm_sentinels, match.start()):
                        safe_reply, escalation = build_false_reassurance_replacement(honorific)
                        return _block(
                            risk_level="high",
                            categories=["false_reassurance_blocked"],
                            added_flags=["post_llm_false_reassurance_blocked"],
                            reply=safe_reply,
                            escalation=escalation,
                            boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                            domain="emergency",
                            rule_id="post_false_reassurance",
                        )

        # ------------------------------------------------------------------
        # 10) Toxic Positivity (Global on harsh dismissive pressure & emotional/self-harm)
        # ------------------------------------------------------------------
        for match in POST_LLM_TOXIC_POSITIVITY_RE.finditer(norm_sentinels):
            if not has_clause_local_negation(norm_sentinels, match.start()):
                if pre_assessment.detected_domain == "self_harm":
                    safe_reply, escalation = build_self_harm_crisis_response(honorific)
                    r_level: RiskLevel = "high"
                else:
                    safe_reply, escalation = build_emotional_support_safe_fallback(honorific)
                    r_level = "moderate"
                return _block(
                    risk_level=r_level,
                    categories=["post_llm_toxic_positivity"],
                    added_flags=["post_llm_toxic_positivity_blocked"],
                    reply=safe_reply,
                    escalation=escalation,
                    boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    domain="emotional_safety",
                    rule_id="post_toxic_positivity",
                )

        # ------------------------------------------------------------------
        # 11) Output Hygiene: Reversed Kinship ("Cháu ơi, cụ...")
        # ------------------------------------------------------------------
        if POST_LLM_REVERSED_KINSHIP_RE.search(norm_sentinels):
            is_emerg_ctx = pre_assessment.risk_level == "critical" or ("115" in norm_flat and has_medical_cue)
            safe_reply, escalation = build_output_hygiene_safe_fallback(
                honorific, is_emergency_context=is_emerg_ctx
            )
            return _block(
                risk_level="critical" if is_emerg_ctx else "moderate",
                categories=["post_llm_reversed_kinship"],
                added_flags=["post_llm_reversed_kinship_blocked"],
                reply=safe_reply,
                escalation=escalation,
                boundary=(
                    KnowledgeBoundary.EMERGENCY_PROTOCOL.value
                    if is_emerg_ctx
                    else KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value
                ),
                domain="output_hygiene",
                rule_id="post_reversed_kinship",
            )

        self._audit_log(stage="post_llm", action="allow", assessment=pre_assessment, start_perf=start_perf)
        return pre_assessment
