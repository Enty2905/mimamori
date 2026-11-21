"""Deterministic Vietnamese safety policies, keywords, and response templates."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum

EMERGENCY_115_HOTLINE = "115"


class KnowledgeBoundary(str, Enum):
    """Explicit knowledge provenance & boundary markers returned to callers."""

    EMERGENCY_PROTOCOL = "emergency_protocol"
    MEDICAL_GUARDRAIL_REFUSAL = "medical_guardrail_refusal"
    RETRIEVED_EVIDENCE = "retrieved_evidence"
    GENERAL_GUIDANCE_ONLY = "general_guidance_only"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


def normalize_vietnamese(text: str) -> str:
    """Lowercase, fold đ->d, and strip Vietnamese diacritics while keeping ASCII punctuation."""
    if not text:
        return ""
    folded = unicodedata.normalize("NFC", text).lower().replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", folded)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", without_marks).strip()


@dataclass(frozen=True)
class EmergencyRule:
    """Emergency symptom pattern group."""

    category: str
    label_vi: str
    phrases: tuple[str, ...]


# Inability-based emergencies where "khong ..." itself IS the emergency symptom.
INABILITY_EMERGENCY_PATTERNS: tuple[tuple[str, str], ...] = (
    ("difficulty_breathing", "khong tho duoc"),
    ("difficulty_breathing", "khong the tho"),
    ("difficulty_breathing", "khong hit tho duoc"),
    ("difficulty_breathing", "khong lay hoi duoc"),
    ("difficulty_breathing", "hong tho duoc"),
    ("difficulty_breathing", "ko tho duoc"),
    ("severe_fall", "khong dung day duoc"),
    ("severe_fall", "khong day duoc sau khi nga"),
    ("severe_fall", "nga khong day duoc"),
    ("severe_fall", "te khong day duoc"),
    ("stroke", "khong noi duoc"),
    ("stroke", "khong cu dong duoc"),
    ("stroke", "khong nhac tay len duoc"),
    ("stroke", "khong nhac chan len duoc"),
    ("severe_bleeding", "khong cam mau duoc"),
    ("severe_bleeding", "mau khong cam duoc"),
)

# Non-emergency phrases that contain deceptive substrings (e.g., "ngat mui" != fainting/suffocation).
BENIGN_EXCLUSION_PHRASES: tuple[str, ...] = (
    "ngat mui",
    "mot xiu",
    "chut xiu",
    "hoi xiu",
    "doi xiu",
    "cho xiu",
    "nga tu",
    "nga ba",
    "nuoc nga",
    "tieng nga",
)

EMERGENCY_RULES: tuple[EmergencyRule, ...] = (
    EmergencyRule(
        category="chest_pain",
        label_vi="đau hoặc tức ngực",
        phrases=(
            "dau nguc",
            "tuc nguc",
            "dau that nguc",
            "nang nguc",
            "nhoi nguc",
            "bop nghet nguc",
            "dau vung tim",
            "dau ngut",
            "tuc ngut",
            "nhoi ngut",
            "that ngut",
            "nang ngut",
            "dau tuc ngut",
            "chest pain",
        ),
    ),
    EmergencyRule(
        category="difficulty_breathing",
        label_vi="khó thở hoặc ngạt thở",
        phrases=(
            "kho tho",
            "tho gap",
            "ngat tho",
            "ngop tho",
            "ngac tho",
            "tho khong noi",
            "khong tho noi",
            "tho hong noi",
            "tho ko noi",
            "tho doc",
            "hut hoi nang",
            "kho khe du doi",
            "shortness of breath",
        ),
    ),
    EmergencyRule(
        category="fainting",
        label_vi="ngất xỉu hoặc mất ý thức",
        phrases=(
            "ngat xiu",
            "ngat siu",
            "ngac xiu",
            "ngac siu",
            "bi ngat",
            "bi xiu",
            "bi siu",
            "ngat di",
            "ngat roi",
            "vua ngat",
            "moi ngat",
            "dot ngot ngat",
            "co lan ngat",
            "suyt xiu",
            "suyt siu",
            "sap xiu",
            "sap siu",
            "bat tinh",
            "mat y thuc",
            "lim di",
            "choang vang sap ngat",
            "toi sam mat may",
            "xay xam mat may",
            "say sam mat may",
            "fainting",
            "passed out",
        ),
    ),
    EmergencyRule(
        category="severe_fall",
        label_vi="té ngã nặng hoặc chấn thương sau ngã",
        phrases=(
            "te nga",
            "bi nga",
            "vap nga",
            "truot nga",
            "truot chan nga",
            "truot te",
            "nga dap dau",
            "te dap dau",
            "nga nang",
            "nga xuong",
            "te xuong",
            "te nhao",
            "nga nhao",
            "nga quy",
            "nga qui",
            "te quy",
            "te qui",
            "nga guc",
            "te sap",
            "nga sap",
            "gay xuong",
            "dau du doi sau nga",
        ),
    ),
    EmergencyRule(
        category="stroke",
        label_vi="dấu hiệu nghi ngờ đột quỵ",
        phrases=(
            "dot quy",
            "dot qui",
            "tai bien",
            "meo mieng",
            "meo mien",
            "noi ngong",
            "noi do",
            "yeu liet nua nguoi",
            "liet nua nguoi",
            "te yeu mot ben",
            "te bi nua nguoi",
            "liet tay chan",
            "lu lan dot ngot",
            "stroke",
        ),
    ),
    EmergencyRule(
        category="severe_bleeding",
        label_vi="chảy máu nhiều hoặc xuất huyết",
        phrases=(
            "chay mau nhieu",
            "chay mau cam nhieu",
            "chay mau khong cam",
            "mau chay khong cam",
            "chay mau o at",
            "mau chay nhieu",
            "xuat huyet",
            "non ra mau",
            "ho ra mau",
            "di ngoai ra mau",
            "tieu ra mau",
            "severe bleeding",
        ),
    ),
)

# Individual moderate warning signs that escalate to critical emergency when combined.
MODERATE_WARNING_SIGNS: dict[str, tuple[str, ...]] = {
    "dizziness": ("chong mat", "chong mac", "chon mat", "choang vang", "choan vang", "choang mat", "quay cuong"),
    "cold_sweat": ("va mo hoi", "toat mo hoi lanh", "toat mo hoi", "do mo hoi lanh", "mo hoi lanh"),
    "nausea_vomiting": ("buon non", "non mua", "oi mua"),
    "severe_headache": ("dau dau du doi", "nhuc dau du doi"),
    "numbness_weakness": ("te tay", "te chan", "yeu tay", "yeu chan", "mat thang bang"),
    "vision_change": ("nhin mo dot ngot", "mo mat dot ngot", "nhin doi"),
    "confusion": ("lo mo", "me man", "mat dinh huong"),
    "palpitations": ("tim dap nhanh", "hoi hop danh trong nguc"),
    "high_fever": ("sot cao",),
}

# Immediate single-sign neurological emergencies.
CRITICAL_SOLO_WARNING_PHRASES: tuple[tuple[str, str], ...] = (
    ("seizure", "co giat"),
    ("seizure", "len con giat"),
)

MULTI_SYMPTOM_CRITICAL_PAIRS: tuple[frozenset[str], ...] = (
    frozenset({"dizziness", "cold_sweat"}),
    frozenset({"dizziness", "nausea_vomiting"}),
    frozenset({"dizziness", "numbness_weakness"}),
    frozenset({"dizziness", "vision_change"}),
    frozenset({"dizziness", "severe_headache"}),
    frozenset({"dizziness", "palpitations"}),
    frozenset({"dizziness", "confusion"}),
    frozenset({"severe_headache", "nausea_vomiting"}),
    frozenset({"severe_headache", "vision_change"}),
    frozenset({"severe_headache", "confusion"}),
    frozenset({"numbness_weakness", "vision_change"}),
    frozenset({"numbness_weakness", "confusion"}),
    frozenset({"cold_sweat", "palpitations"}),
    frozenset({"cold_sweat", "nausea_vomiting"}),
    frozenset({"high_fever", "confusion"}),
)

NEGATION_MARKERS: tuple[str, ...] = (
    "chua bao gio",
    "khong con",
    "khong phai",
    "khong bi",
    "khong co",
    "khong thay",
    "khong he",
    "chua tung",
    "chua he",
    "chua bi",
    "da het",
    "het bi",
    "khong",
    "chua",
    "chang",
    "het",
)

PREVENTIVE_OR_INFO_MARKERS: tuple[str, ...] = (
    "phong ngua",
    "phong tranh",
    "cach phong",
    "cach tranh",
    "khong muon bi",
    "tranh bi",
    "tim hieu ve",
    "doc ve",
)

HISTORICAL_TIME_MARKERS: tuple[str, ...] = (
    "nam ngoai",
    "nam truoc",
    "thang truoc",
    "tuan truoc",
    "hoi truoc",
    "truoc day",
    "ngay xua",
    "luc truoc",
    "hoi xua",
    "hoi tre",
    "may thang truoc",
    "vai thang truoc",
    "may nam truoc",
    "vai nam truoc",
    "da tung",
    "tung bi",
)

HISTORICAL_TIME_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Only treat "cách đây ..." as distant historical when the unit is weeks/months/years (never minutes/hours).
    re.compile(
        r"\bcach day (?:\d+|vai|may|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|nhieu)\s+(?:tuan|thang|nam)\b"
    ),
    re.compile(r"\bnam (?:19\d\d|20[01]\d|202[0-5])\b"),
)

HYPOTHETICAL_STRONG_MARKERS: tuple[str, ...] = (
    "gia su",
    "vi du",
    "neu lo",
    "lo nhu",
    "lo ma",
    "neu nhu",
    "chang may",
    "nho bi",
    "nho ma",
)

HYPOTHETICAL_CONDITIONAL_MARKERS: tuple[str, ...] = (
    "neu",
    "truong hop",
)

HYPOTHETICAL_QUESTION_MARKERS: tuple[str, ...] = (
    "thi sao",
    "lam sao",
    "lam gi",
    "xu tri",
    "can lam",
    "co can",
    "nen lam",
    "the nao",
    "nhu nao",
    "goi ai",
    "bao ai",
    "thi nen",
    "thi goi",
    "thi phai",
)

ACTIVE_CURRENT_OVERRIDE_MARKERS: tuple[str, ...] = (
    "dang",
    "hien tai",
    "hien nay",
    "bay gio",
    "luc nay",
    "hom nay",
    "sang nay",
    "trua nay",
    "chieu nay",
    "toi nay",
    "vua moi",
    "moi day",
    "vua bi",
    "moi bi",
    "vua roi",
    "nay gio",
    "tu sang",
    "tu toi qua",
    "van con",
    "van bi",
    "van thay",
    "lai bi",
    "lai dau",
    "lai thay",
    "khong do",
)

DIAGNOSIS_REQUEST_PHRASES: tuple[str, ...] = (
    "bi benh gi",
    "mac benh gi",
    "la benh gi",
    "chan doan",
    "co phai benh",
    "co phai bi benh",
    "ket luan benh",
    "trieu chung nay la benh gi",
    "xem giup toi bi benh",
    "kham giup xem bi benh",
)

DIAGNOSIS_REQUEST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:bi|mac|la|thanh)\s+(?:benh|chung)\s+gi\b"),
    re.compile(r"\bket luan\b.{0,25}\b(?:benh|bi gi|mac gi|co phai)\b"),
    re.compile(
        r"\b(?:co phai|lieu co phai)\b.{0,25}\b(?:bi|mac|benh|suy tim|tieu duong|huyet ap|viem phoi|tai bien|dot quy|gan|than|khop|ung thu|roi loan)\b"
    ),
    re.compile(r"\b(?:xem giup|kham giup|doan xem|theo chau)\b.{0,50}\b(?:bi gi|benh gi|chung gi|lam sao|co phai)\b"),
)

PRESCRIPTION_DOSAGE_REQUEST_PHRASES: tuple[str, ...] = (
    "ke don",
    "ke thuoc",
    "cho thuoc",
    "nen uong thuoc gi",
    "uong thuoc gi",
    "mua thuoc gi",
    "tang lieu",
    "giam lieu",
    "chinh lieu",
    "uong gap doi",
    "uong them vien",
    "uong may vien",
    "chia doi vien",
    "tu bo thuoc",
    "bo thuoc",
    "ngung thuoc",
    "ngung uong thuoc",
    "tu dung thuoc",
    "co nen dung thuoc",
    "dung uong thuoc",
    "doi thuoc",
    "doi sang thuoc",
)

PRESCRIPTION_DOSAGE_REQUEST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bke\s+(?:giup|ho|cho)\b.{0,25}\b(?:thuoc|don)\b"),
    re.compile(r"\b(?:cho|goi y|tu van)\b.{0,20}\b(?:uong|mua|dung)\s+thuoc\s+(?:gi|nao)\b"),
    re.compile(r"\b(?:tang|giam|chinh|thay doi|doi)\s+(?:lieu|luong thuoc|sang thuoc|sang loai thuoc)\b"),
    re.compile(
        r"\b(?:uong|dung)\s+(?:gap doi|them\s+(?:(?:\d+|mot|hai|ba|bon|nam|nua)\s+)?vien|may vien|bao nhieu vien|nua vien|bu lieu|don lieu)\b"
    ),
    re.compile(
        r"\b(?:bo bot|giam bot|uong bot|be doi|chia doi|be nua|uong nua|con nua)\b.{0,20}\b(?:vien|lieu|thuoc|huyet ap|tieu duong)\b"
    ),
    re.compile(r"\b(?:tu y\s+)?(?:bo|ngung|tu bo)\s+(?:uong\s+)?(?:thuoc|lieu|cu thuoc)\b"),
)

# Accent-sensitive pattern on lowercased NFC text so "dừng thuốc" (stop) triggers while "dùng thuốc" (use) does not.
ACCENTED_STOP_MEDICATION_PATTERN: re.Pattern[str] = re.compile(
    r"\b(?:dừng|ngừng)\s+(?:uống\s+)?(?:thuốc|liều)\b"
)

MEDICATION_STATUS_QUERY_PHRASES: tuple[str, ...] = (
    "da uong thuoc chua",
    "uong thuoc chua",
    "sang nay uong chua",
    "toi nay uong chua",
    "hom nay uong thuoc chua",
    "uong lieu nay chua",
)

UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:xac nhan|ghi nhan|danh dau|coi nhu|bo sung)\b.{0,35}\b(?:da uong|uong roi)\b"),
)

# Post-LLM patterns verifying LLM replies do not violate medical boundaries.
POST_LLM_DIAGNOSIS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:chan doan|ket luan)\s+(?:la|bac bi|ong bi|ba bi|ban bi)\b"),
    re.compile(r"\b(?:bac|ong|ba|cu|ban)\s+(?:da\s+)?(?:mac|bi)\s+benh\s+[a-z0-9\s]{2,30}"),
    re.compile(r"\bchac chan (?:la )?(?:benh|viem|tieu duong|cao huyet ap|suy tim)\b"),
)

POST_LLM_DOSAGE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:hay|nen|co the|cu)\s+(?:tang|giam|chinh)\s+lieu\b"),
    re.compile(r"\b(?:hay|nen|cu)\s+uong\s+(?:\d+|mot|hai|ba|bon)\s+vien\b"),
    re.compile(r"\b(?:hay|nen|cu)\s+(?:uong gap doi|bo thuoc|ngung uong thuoc|doi sang thuoc)\b"),
    re.compile(r"\b(?:chau|toi)\s+(?:ke don|ke thuoc|cho bac uong)\b"),
)

POST_LLM_TAKEN_CLAIM_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:bac|ong|ba|cu|ban)?\s*(?:da\s+uong|da\s+dung)\s+(?:thuoc|lieu)(?:\s+[a-z0-9\-\s]{0,30})?(?:\s+roi|\s+hom nay|\s+sang nay|\s+toi nay)?\b"
    ),
    re.compile(r"\b(?:da\s+ghi\s+nhan|da\s+xac\s+nhan|da\s+danh\s+dau)\s+(?:uong\s+thuoc|da\s+uong)\b"),
    re.compile(r"\bhoan thanh lieu thuoc\b"),
)

FALSE_REASSURANCE_PHRASES: tuple[str, ...] = (
    "khong sao dau",
    "cu yen tam",
    "binh thuong thoi",
    "khong can di kham",
    "tu khoi thoi",
    "khong co gi dang lo",
    "ngu mot giac la het",
)


def build_emergency_response(honorific: str, matched_labels: list[str]) -> tuple[str, str]:
    """Return deterministic emergency reply and escalation guidance (zero false reassurance)."""
    symptoms_text = ", ".join(matched_labels) if matched_labels else "dấu hiệu nguy hiểm"
    reply = (
        f"Cảnh báo khẩn cấp: {honorific.capitalize()} đang có dấu hiệu {symptoms_text}. "
        f"Xin {honorific} ngừng di chuyển ngay, ngồi hoặc nằm ở tư thế an toàn, "
        f"liên hệ ngay với người thân trong gia đình và gọi cấp cứu 115 lập tức để được hỗ trợ y tế kịp thời."
    )
    escalation = (
        "Gọi ngay cấp cứu 115 và thông báo lập tức cho người thân/người chăm sóc. "
        "Không tự lái xe hoặc chờ đợi triệu chứng tự qua."
    )
    return reply, escalation


def build_diagnosis_refusal_response(honorific: str) -> tuple[str, str]:
    """Return deterministic non-diagnostic guidance."""
    reply = (
        f"Cháu không thể chẩn đoán bệnh hay kết luận nguyên nhân triệu chứng thay cho bác sĩ ạ. "
        f"Để an toàn, {honorific} nên trao đổi với người thân và đi khám bác sĩ chuyên khoa "
        f"hoặc cơ sở y tế để được thăm khám trực tiếp và chính xác nhất."
    )
    escalation = "Tham khảo bác sĩ hoặc cơ sở y tế để được thăm khám, đồng thời báo cho người thân theo dõi."
    return reply, escalation


def build_dosage_refusal_response(honorific: str) -> tuple[str, str]:
    """Return deterministic anti-prescribing and anti-dosage-modification guidance."""
    reply = (
        f"Cháu không được phép kê đơn, đổi thuốc hay điều chỉnh liều lượng thuốc cho {honorific} ạ. "
        f"{honorific.capitalize()} vui lòng giữ đúng đơn thuốc hiện tại, không tự ý tăng, giảm hoặc ngừng thuốc, "
        f"và hỏi ý kiến bác sĩ điều trị hoặc dược sĩ trước khi thay đổi."
    )
    escalation = "Liên hệ bác sĩ điều trị, dược sĩ hoặc người thân phụ trách thuốc để kiểm tra lại đơn thuốc."
    return reply, escalation


def build_unrecorded_medication_response(
    honorific: str,
    taken_meds: list[str],
    pending_or_missed_meds: list[str],
) -> tuple[str, str]:
    """Return deterministic response preventing false claims about unrecorded medication intake."""
    if not taken_meds and not pending_or_missed_meds:
        reply = (
            f"Trong dữ liệu theo dõi hiện tại, cháu chưa có ghi nhận nào xác nhận {honorific} đã uống thuốc, "
            f"và cháu cũng không thể tự đánh dấu thay cho hệ thống ạ. "
            f"{honorific.capitalize()} hãy kiểm tra hộp thuốc, xem mục Thuốc trên ứng dụng hoặc hỏi người thân để chắc chắn trước khi dùng liều tiếp theo."
        )
    elif not taken_meds and pending_or_missed_meds:
        pending_str = ", ".join(pending_or_missed_meds[:4])
        reply = (
            f"Theo lịch theo dõi hiện có, các thuốc ({pending_str}) hiện vẫn đang ở trạng thái chưa ghi nhận đã uống. "
            f"Cháu không thể xác nhận thay là {honorific} đã uống rồi; {honorific} vui lòng kiểm tra lại vỉ thuốc hoặc hỏi người thân trước khi uống bù nhé."
        )
    else:
        taken_str = ", ".join(taken_meds[:4])
        pending_str = ", ".join(pending_or_missed_meds[:4]) if pending_or_missed_meds else "không có liều chờ khác"
        reply = (
            f"Trong dữ liệu hiện tại, hệ thống mới chỉ ghi nhận đã uống: {taken_str}; "
            f"các mục còn lại ({pending_str}) chưa có xác nhận đã uống. "
            f"Cháu không thể tự ghi nhận thêm liều chưa có xác nhận, {honorific} hãy kiểm tra hộp thuốc hoặc xác nhận trực tiếp trên mục Thuốc của ứng dụng ạ."
        )
    escalation = "Kiểm tra nhật ký thuốc trên ứng dụng Mimamori hoặc xác nhận cùng người thân trước khi dùng thêm liều."
    return reply, escalation
