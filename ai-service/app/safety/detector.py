"""Deterministic pre-LLM and post-LLM safety detector independent of LLMs."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

from app.safety.policies import (
    ACCENTED_STOP_MEDICATION_PATTERN,
    ACTIVE_CURRENT_OVERRIDE_MARKERS,
    BENIGN_EXCLUSION_PHRASES,
    CRITICAL_SOLO_WARNING_PHRASES,
    DIAGNOSIS_REQUEST_PATTERNS,
    DIAGNOSIS_REQUEST_PHRASES,
    EMERGENCY_RULES,
    FALSE_REASSURANCE_PHRASES,
    HISTORICAL_TIME_MARKERS,
    HISTORICAL_TIME_PATTERNS,
    HYPOTHETICAL_CONDITIONAL_MARKERS,
    HYPOTHETICAL_QUESTION_MARKERS,
    HYPOTHETICAL_STRONG_MARKERS,
    INABILITY_EMERGENCY_PATTERNS,
    MEDICATION_STATUS_QUERY_PHRASES,
    MODERATE_WARNING_SIGNS,
    MULTI_SYMPTOM_CRITICAL_PAIRS,
    NEGATION_MARKERS,
    POST_LLM_DIAGNOSIS_PATTERNS,
    POST_LLM_DOSAGE_PATTERNS,
    POST_LLM_TAKEN_CLAIM_PATTERNS,
    PRESCRIPTION_DOSAGE_REQUEST_PATTERNS,
    PRESCRIPTION_DOSAGE_REQUEST_PHRASES,
    PREVENTIVE_OR_INFO_MARKERS,
    UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS,
    KnowledgeBoundary,
    build_diagnosis_refusal_response,
    build_dosage_refusal_response,
    build_emergency_response,
    build_unrecorded_medication_response,
    normalize_vietnamese,
)
from app.schemas.companion import PersonalContextPayload, RiskLevel

_CLAUSE_SPLIT_RE = re.compile(
    r"[.!?;,\n]+|\b(?:nhung|tuy nhien|ma lai|con bay gio|con gio|con hien tai|hien tai thi)\b"
)
_NEGATION_PREWINDOW_STOPWORDS = frozenset({"va", "nhung", "ma", "dang", "tu dung", "dot ngot", "lai"})
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
    }
)
_CLINICIAN_DIAGNOSIS_REPORT_RE = re.compile(
    r"\b(?:bac si|benh vien|phong kham|duoc|da duoc)\s+(?:da\s+|moi\s+)?chan doan\b"
)
_PRE_NEGATION_REPLY_PHRASES = (
    "khong",
    "khong duoc",
    "khong nen",
    "khong tu y",
    "tranh",
    "dung",
    "chua",
    "chua co ghi nhan",
    "khong thay ghi nhan",
    "khong the xac nhan",
    "chua xac nhan",
)


@dataclass
class SafetyAssessment:
    """Result of deterministic pre-LLM or post-LLM safety evaluation."""

    safety_triggered: bool = False
    bypass_llm: bool = False
    risk_level: RiskLevel = "low"
    matched_categories: list[str] = field(default_factory=list)
    guardrail_flags: list[str] = field(default_factory=list)
    deterministic_reply: Optional[str] = None
    escalation_guidance: Optional[str] = None
    knowledge_boundary: Optional[str] = None
    has_unrecorded_medication_risk: bool = False


class SafetyDetector:
    """Deterministic safety engine protecting against emergencies and medical overreach."""

    @staticmethod
    def _phrase_pattern(phrase: str) -> re.Pattern[str]:
        escaped = re.escape(phrase)
        return re.compile(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])")

    @staticmethod
    def _strip_benign_exclusions(normalized_clause: str) -> str:
        cleaned = normalized_clause
        for benign in BENIGN_EXCLUSION_PHRASES:
            cleaned = re.sub(rf"(?<![a-z0-9]){re.escape(benign)}(?![a-z0-9])", " ", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    @staticmethod
    def _is_negated_or_preventive(clause: str, match_start: int, all_symptom_phrases: set[str]) -> bool:
        """Check whether the matched symptom inside a clause is negated or purely preventive."""
        prefix = clause[:match_start].strip()
        if not prefix:
            return False

        for marker in PREVENTIVE_OR_INFO_MARKERS:
            if re.search(rf"(?<![a-z0-9]){re.escape(marker)}(?![a-z0-9])", prefix):
                return True

        # Inspect only the trailing tokens after any affirmative reset (e.g. "khong an duoc va dang ...")
        tokens = prefix.split()
        # Look back up to 7 tokens; reset window on affirmative/contrastive shift words.
        recent_tokens: list[str] = []
        for tok in reversed(tokens[-7:]):
            if tok in {"dang", "lai", "tu", "dot", "ma", "nhung"} and recent_tokens:
                break
            recent_tokens.append(tok)
        recent_window = " ".join(reversed(recent_tokens))

        # Find the closest (rightmost) negation marker in recent_window before the symptom.
        best_match: Optional[re.Match[str]] = None
        for neg in NEGATION_MARKERS:
            neg_re = re.compile(rf"(?<![a-z0-9]){re.escape(neg)}(?![a-z0-9])")
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
        # Handle coordinated negation like "khong dau nguc hay kho tho" / "khong bi dau nguc va kho tho"
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
    def _is_historical_clause(cls, clause: str) -> bool:
        if cls._has_active_current_marker(clause):
            return False
        if any(cls._phrase_pattern(marker).search(clause) for marker in HISTORICAL_TIME_MARKERS):
            return True
        return any(pattern.search(clause) for pattern in HISTORICAL_TIME_PATTERNS)

    @classmethod
    def _evaluate_symptom_clauses(
        cls, normalized_text: str
    ) -> tuple[list[str], list[str], set[str], bool]:
        """Return (matched_categories, matched_labels_vi, matched_moderate_signs, historical_signs_found)."""
        matched_categories: list[str] = []
        matched_labels: list[str] = []
        moderate_signs: set[str] = set()
        historical_signs_found = False

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

            if cls._is_hypothetical_clause(clause):
                continue

            is_historical = cls._is_historical_clause(clause)

            # 1) Explicit inability emergencies (e.g., "khong tho duoc", "khong dung day duoc")
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

            # 2) Solo critical neurological emergencies (e.g., seizure)
            for category, phrase in CRITICAL_SOLO_WARNING_PHRASES:
                match = cls._phrase_pattern(phrase).search(clause)
                if match and not cls._is_negated_or_preventive(clause, match.start(), all_known_phrases):
                    if is_historical:
                        historical_signs_found = True
                    elif category not in matched_categories:
                        matched_categories.append(category)
                        matched_labels.append("co giật")

            # 3) Six core emergency symptom categories with negated-vs-affirmative guard
            for rule in EMERGENCY_RULES:
                for phrase in rule.phrases:
                    match = cls._phrase_pattern(phrase).search(clause)
                    if match and not cls._is_negated_or_preventive(
                        clause, match.start(), all_known_phrases
                    ):
                        if is_historical:
                            historical_signs_found = True
                        elif rule.category not in matched_categories:
                            matched_categories.append(rule.category)
                            matched_labels.append(rule.label_vi)
                        break

            # 4) Moderate warning signs for multi-symptom escalation detection
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

        # Evaluate multi-symptom critical combinations
        for combo in MULTI_SYMPTOM_CRITICAL_PAIRS:
            if combo.issubset(moderate_signs):
                matched_categories.append("multi_symptom_warning")
                matched_labels.append("nhiều triệu chứng cảnh báo cùng lúc")
                break

        return matched_categories, matched_labels, moderate_signs, historical_signs_found

    @classmethod
    def _collect_affirmative_emergencies(
        cls, normalized_text: str
    ) -> tuple[list[str], list[str], set[str]]:
        """Return (matched_categories, matched_labels_vi, matched_moderate_signs)."""
        cats, labels, moderate_signs, _ = cls._evaluate_symptom_clauses(normalized_text)
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
    def _has_pre_negation_in_reply(reply_norm: str, match_start: int) -> bool:
        window = reply_norm[max(0, match_start - 36) : match_start]
        return any(
            re.search(rf"(?<![a-z0-9]){re.escape(neg)}(?![a-z0-9])\s*$", window)
            or re.search(rf"(?<![a-z0-9]){re.escape(neg)}(?![a-z0-9])", window[-24:])
            for neg in _PRE_NEGATION_REPLY_PHRASES
        )

    def evaluate_input(
        self,
        message: str,
        personal_context: Optional[PersonalContextPayload] = None,
    ) -> SafetyAssessment:
        """Run deterministic pre-LLM emergency & medical safety checks on user input."""
        raw_lower_nfc = unicodedata.normalize("NFC", message).lower() if message else ""
        norm = normalize_vietnamese(message)
        honorific = (
            personal_context.preferred_honorific
            if personal_context and personal_context.preferred_honorific
            else "ông/bà"
        )

        # 1) Emergency detector ALWAYS takes top priority and bypasses LLM.
        emerg_cats, emerg_labels, moderate_signs, historical_signs_found = (
            self._evaluate_symptom_clauses(norm)
        )
        if emerg_cats:
            reply, escalation = build_emergency_response(honorific, emerg_labels)
            return SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="critical",
                matched_categories=emerg_cats,
                guardrail_flags=["emergency_115_escalation"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.EMERGENCY_PROTOCOL.value,
            )

        # 2) Pre-LLM medical guardrails: diagnosis requests & prescription/dosage changes
        has_dosage_request = (
            bool(ACCENTED_STOP_MEDICATION_PATTERN.search(raw_lower_nfc))
            or any(self._phrase_pattern(p).search(norm) for p in PRESCRIPTION_DOSAGE_REQUEST_PHRASES)
            or any(pattern.search(norm) for pattern in PRESCRIPTION_DOSAGE_REQUEST_PATTERNS)
        )
        if has_dosage_request:
            reply, escalation = build_dosage_refusal_response(honorific)
            return SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["prescription_or_dosage_change"],
                guardrail_flags=["pre_llm_dosage_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
            )

        is_clinician_report = bool(_CLINICIAN_DIAGNOSIS_REPORT_RE.search(norm))
        has_diagnosis_phrase = any(
            self._phrase_pattern(p).search(norm)
            for p in DIAGNOSIS_REQUEST_PHRASES
            if not (p == "chan doan" and is_clinician_report)
        )
        has_diagnosis_request = has_diagnosis_phrase or any(
            pattern.search(norm) for pattern in DIAGNOSIS_REQUEST_PATTERNS
        )
        if has_diagnosis_request:
            reply, escalation = build_diagnosis_refusal_response(honorific)
            return SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="high",
                matched_categories=["diagnosis_request"],
                guardrail_flags=["pre_llm_diagnosis_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
            )

        # 3) Unrecorded medication intake claim/confirmation request
        taken_meds, not_taken_meds = self._extract_medication_status_lists(personal_context)
        asks_to_mark_taken = any(
            p.search(norm) for p in UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS
        )
        asks_med_status = any(
            self._phrase_pattern(p).search(norm) for p in MEDICATION_STATUS_QUERY_PHRASES
        )
        if asks_to_mark_taken and (not taken_meds or bool(not_taken_meds)):
            reply, escalation = build_unrecorded_medication_response(
                honorific, taken_meds, not_taken_meds
            )
            return SafetyAssessment(
                safety_triggered=True,
                bypass_llm=True,
                risk_level="moderate",
                matched_categories=["unrecorded_medication_intake"],
                guardrail_flags=["pre_llm_unrecorded_medication_guardrail"],
                deterministic_reply=reply,
                escalation_guidance=escalation,
                knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                has_unrecorded_medication_risk=True,
            )

        # Moderate standalone or historical warning signs inform risk_level & post-check without 115 false alarms.
        risk_level: RiskLevel = (
            "moderate" if moderate_signs or historical_signs_found or asks_med_status else "low"
        )
        flags: list[str] = []
        if moderate_signs:
            flags.append("moderate_symptom_monitoring")
        if historical_signs_found:
            flags.append("historical_symptom_context")
        if asks_med_status or asks_to_mark_taken:
            flags.append("medication_adherence_check")

        categories = sorted(moderate_signs)
        if historical_signs_found:
            categories.append("historical_symptom")

        return SafetyAssessment(
            safety_triggered=False,
            bypass_llm=False,
            risk_level=risk_level,
            matched_categories=categories,
            guardrail_flags=flags,
            has_unrecorded_medication_risk=(asks_med_status or asks_to_mark_taken or not taken_meds),
        )

    def validate_output(
        self,
        reply_text: str,
        pre_assessment: SafetyAssessment,
        personal_context: Optional[PersonalContextPayload] = None,
    ) -> SafetyAssessment:
        """Post-LLM deterministic guardrail blocking diagnosis, dosage edits, false reassurance,
        and unrecorded medication intake claims in model output.
        """
        norm = normalize_vietnamese(reply_text)
        honorific = (
            personal_context.preferred_honorific
            if personal_context and personal_context.preferred_honorific
            else "ông/bà"
        )

        # 1) Block diagnostic claims by LLM
        for pattern in POST_LLM_DIAGNOSIS_PATTERNS:
            m = pattern.search(norm)
            if m and not self._has_pre_negation_in_reply(norm, m.start()):
                safe_reply, escalation = build_diagnosis_refusal_response(honorific)
                return SafetyAssessment(
                    safety_triggered=True,
                    bypass_llm=True,
                    risk_level="high",
                    matched_categories=["post_llm_diagnosis_claim"],
                    guardrail_flags=[*pre_assessment.guardrail_flags, "post_llm_diagnosis_blocked"],
                    deterministic_reply=safe_reply,
                    escalation_guidance=escalation,
                    knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                )

        # 2) Block prescription or dosage modification claims by LLM
        for pattern in POST_LLM_DOSAGE_PATTERNS:
            m = pattern.search(norm)
            if m and not self._has_pre_negation_in_reply(norm, m.start()):
                safe_reply, escalation = build_dosage_refusal_response(honorific)
                return SafetyAssessment(
                    safety_triggered=True,
                    bypass_llm=True,
                    risk_level="high",
                    matched_categories=["post_llm_dosage_claim"],
                    guardrail_flags=[*pre_assessment.guardrail_flags, "post_llm_dosage_blocked"],
                    deterministic_reply=safe_reply,
                    escalation_guidance=escalation,
                    knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                )

        # 3) Block false reassurance when any symptom risk is elevated
        if pre_assessment.risk_level in {"moderate", "high", "critical"}:
            for phrase in FALSE_REASSURANCE_PHRASES:
                if self._phrase_pattern(phrase).search(norm):
                    safe_reply = (
                        f"{honorific.capitalize()} nên tiếp tục theo dõi sát triệu chứng hiện tại và báo cho người thân "
                        f"hoặc liên hệ cơ sở y tế để được kiểm tra; nếu có dấu hiệu nặng hơn như đau ngực, khó thở "
                        f"hay choáng ngất, hãy gọi cấp cứu 115 ngay lập tức."
                    )
                    return SafetyAssessment(
                        safety_triggered=True,
                        bypass_llm=True,
                        risk_level="high",
                        matched_categories=["false_reassurance_blocked"],
                        guardrail_flags=[
                            *pre_assessment.guardrail_flags,
                            "post_llm_false_reassurance_blocked",
                        ],
                        deterministic_reply=safe_reply,
                        escalation_guidance="Theo dõi triệu chứng cùng người thân và gọi 115 nếu diễn tiến nặng.",
                        knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    )

        # 4) Block claims that unrecorded medications were taken
        taken_meds, not_taken_meds = self._extract_medication_status_lists(personal_context)
        taken_norm = {normalize_vietnamese(name) for name in taken_meds}
        not_taken_norm = {normalize_vietnamese(name) for name in not_taken_meds}

        for pattern in POST_LLM_TAKEN_CLAIM_PATTERNS:
            for match in pattern.finditer(norm):
                if self._has_pre_negation_in_reply(norm, match.start()):
                    continue
                snippet = norm[max(0, match.start() - 20) : min(len(norm), match.end() + 45)]
                # Violation if no TAKEN medications exist at all, OR snippet attributes intake to a PENDING/MISSED med.
                mentions_unrecorded_med = any(med and med in snippet for med in not_taken_norm)
                mentions_taken_med = any(med and med in snippet for med in taken_norm)
                if not taken_norm or (mentions_unrecorded_med and not mentions_taken_med):
                    safe_reply, escalation = build_unrecorded_medication_response(
                        honorific, taken_meds, not_taken_meds
                    )
                    return SafetyAssessment(
                        safety_triggered=True,
                        bypass_llm=True,
                        risk_level="moderate",
                        matched_categories=["unrecorded_medication_claim"],
                        guardrail_flags=[
                            *pre_assessment.guardrail_flags,
                            "post_llm_unrecorded_medication_blocked",
                        ],
                        deterministic_reply=safe_reply,
                        escalation_guidance=escalation,
                        knowledge_boundary=KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                    )

        return pre_assessment
