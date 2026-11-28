"""Deterministic Vietnamese safety policies, rules, and re-exported templates."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum

from app.safety._normalizer import (
    CONTRAST_PIVOT_RE,
    capitalize_honorific,
    has_clause_local_negation,
    has_explicit_anti_delay_guard,
    normalize_safety_text,
    resolve_honorific,
    strip_markdown_and_zero_width,
)
from app.safety._templates import (
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
)

EMERGENCY_115_HOTLINE = "115"


class KnowledgeBoundary(str, Enum):
    """Explicit knowledge provenance & boundary markers returned to callers."""

    EMERGENCY_PROTOCOL = "emergency_protocol"
    MEDICAL_GUARDRAIL_REFUSAL = "medical_guardrail_refusal"
    PRIVACY_BOUNDARY = "privacy_boundary"
    CAPABILITY_BOUNDARY = "capability_boundary"
    RETRIEVED_EVIDENCE = "retrieved_evidence"
    GENERAL_GUIDANCE_ONLY = "general_guidance_only"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


def normalize_vietnamese(text: str) -> str:
    """Lowercase, fold đ->d, and strip Vietnamese diacritics while keeping ASCII punctuation.

    IMPORTANT: Do NOT alter this function's behavior — used by HashDevEmbedder & MockModelProvider.
    """
    if not text:
        return ""
    folded = unicodedata.normalize("NFC", text).lower().replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", folded)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", without_marks).strip()


@dataclass(frozen=True)
class EmergencyRule:
    """Emergency symptom pattern group supporting contiguous phrases and flexible distance regexes."""

    category: str
    label_vi: str
    phrases: tuple[str, ...]
    patterns: tuple[re.Pattern[str], ...] = ()
    sub_type: str = "default"


# Inability-based emergencies where "khong ..." itself IS the emergency symptom.
INABILITY_EMERGENCY_PATTERNS: tuple[tuple[str, str], ...] = (
    ("difficulty_breathing", "khong tho duoc"),
    ("difficulty_breathing", "khong the tho"),
    ("difficulty_breathing", "khong hit tho duoc"),
    ("difficulty_breathing", "khong lay hoi duoc"),
    ("difficulty_breathing", "hong tho duoc"),
    ("difficulty_breathing", "ko tho duoc"),
    ("severe_asthma", "khong noi tron cau"),
    ("severe_asthma", "khong noi tron duoc cau"),
    ("severe_fall", "khong dung day duoc"),
    ("severe_fall", "khong day duoc sau khi nga"),
    ("severe_fall", "nga khong day duoc"),
    ("severe_fall", "te khong day duoc"),
    ("gi_bleeding", "khong dung vung duoc"),
    ("stroke", "khong noi duoc"),
    ("stroke", "khong cu dong duoc"),
    ("stroke", "khong nhac tay len duoc"),
    ("stroke", "khong nhac tay len noi"),
    ("stroke", "khong nhac len noi"),
    ("stroke", "khong nhac chan len duoc"),
    ("severe_bleeding", "khong cam mau duoc"),
    ("severe_bleeding", "mau khong cam duoc"),
    ("choking_airway_obstruction", "khong ho duoc"),
    ("choking_airway_obstruction", "khong nuot duoc"),
)

# Regex inability patterns for non-contiguous Vietnamese phrasing (e.g., ph-em-002, ph-em-013).
INABILITY_EMERGENCY_REGEXES: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "stroke",
        re.compile(
            r"\b(?:canh\s+)?(?:tay|chan)\b.{0,30}\b(?:khong\s+nhac.{0,15}(?:len\s+)?(?:noi|duoc)|buong\s+thong)\b"
        ),
    ),
    (
        "severe_asthma",
        re.compile(r"\bkhong\s+noi\s+tron.{0,15}cau\b"),
    ),
)

# Non-emergency idioms/homographs excluded from emergency symptom matching.
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
    "mat mo chan cham",
    "hoi moi tay",
    "tim ba lai dap thinh thich",
    "tim dap thinh thich lo so",
)

# Priority order for mapping matched emergency categories to specialized TTS sub-templates.
EMERGENCY_SUBTYPE_PRIORITY: tuple[tuple[str, str], ...] = (
    ("choking_airway_obstruction", "choking"),
    ("anaphylaxis", "anaphylaxis"),
    ("acute_vision_loss", "acute_vision_loss"),
    ("severe_asthma", "severe_asthma"),
    ("severe_burn", "scald_burn"),
    ("heatstroke", "heatstroke"),
    ("gi_bleeding", "gi_bleeding"),
    ("severe_hypoglycemia", "hypoglycemia"),
    ("stroke", "stroke"),
    ("chest_pain", "chest_pain"),
)

EMERGENCY_RULES: tuple[EmergencyRule, ...] = (
    EmergencyRule(
        category="chest_pain",
        label_vi="đau hoặc tức ngực",
        sub_type="chest_pain",
        phrases=(
            "dau nguc",
            "tuc nguc",
            "dau that nguc",
            "dau tuc nguc",
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
        patterns=(
            re.compile(
                r"\bnguc(?:\s+(?:trai|phai|giua))?\b.{0,28}\b"
                r"(?:dau that|dau tuc|tuc nang|nhoi|bop nghet|de len|tang da|dau du doi)\b"
            ),
            re.compile(r"\bdau that.{0,25}\b(?:giua nguc|vung nguc|nguc trai|vai trai|canh tay trai)\b"),
        ),
    ),
    EmergencyRule(
        category="stroke",
        label_vi="dấu hiệu nghi ngờ đột quỵ",
        sub_type="stroke",
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
        patterns=(
            re.compile(r"\bnua\s+mat\b.{0,25}\b(?:te cung|te bi|lech|xe)\b"),
            re.compile(r"\bmieng\b.{0,14}\bmeo\b"),
            re.compile(r"\b(?:canh\s+)?tay\s+(?:phai|trai)\b.{0,25}\b(?:buong thong|yeu han|liet)\b"),
        ),
    ),
    EmergencyRule(
        category="choking_airway_obstruction",
        label_vi="hóc dị vật hoặc tắc nghẽn đường thở",
        sub_type="choking",
        phrases=(
            "hoc nghen",
            "hoc di vat",
            "mac nghen",
            "hoc xuong ca",
            "tho rit",
            "tim tai",
            "choking",
        ),
        patterns=(
            re.compile(r"\bhoc\b.{0,25}\b(?:nghen|co hong|kho tho|tho rit|tim tai)\b"),
        ),
    ),
    EmergencyRule(
        category="severe_hypoglycemia",
        label_vi="dấu hiệu hạ đường huyết nặng",
        sub_type="hypoglycemia",
        phrases=(
            "ha duong huyet nang",
            "muon la di",
            "sap la di",
            "noi lap bap",
        ),
        patterns=(
            re.compile(
                r"\b(?:tiem|uong).{0,25}(?:tieu duong|insulin).{0,80}"
                r"(?:run lay bay|mo hoi lanh|hoa mat|mat hoa|noi lap bap|la di|lo mo)\b"
            ),
            re.compile(
                r"\brun\s+lay\s+bay\b.{0,55}\b(?:mo hoi lanh|hoa mat|mat hoa|lap bap|la di|tieu duong|insulin)\b"
            ),
            re.compile(r"\bha\s+duong\s+huyet\b"),
        ),
    ),
    EmergencyRule(
        category="anaphylaxis",
        label_vi="dấu hiệu nghi ngờ phản vệ nặng",
        sub_type="anaphylaxis",
        phrases=(
            "soc phan ve",
            "phan ve",
            "co hong nghen dac",
            "nghen co hong",
            "sung vu moi",
            "sung moi sung luoi",
        ),
        patterns=(
            re.compile(r"\b(?:moi|luoi|mi mat|mat)\b.{0,25}\b(?:sung vu|sung to|sung phong|phu ne)\b"),
            re.compile(r"\b(?:sung moi|sung luoi|sung mat|mi mat sung)\b.{0,45}\b(?:kho tho|kho khe|nghen)\b"),
        ),
    ),
    EmergencyRule(
        category="gi_bleeding",
        label_vi="xuất huyết tiêu hóa",
        sub_type="gi_bleeding",
        phrases=(
            "non ra mau",
            "oi ra mau",
            "di ngoai ra mau",
            "di ngoai phan den",
            "phan den nhu ba ca phe",
            "xuat huyet tieu hoa",
        ),
        patterns=(
            re.compile(r"\b(?:non|oi)\s+ra.{0,22}\bmau\b"),
            re.compile(r"\bphan\s+den\b.{0,25}\b(?:ba ca phe|hoi tanh|met la|choang)\b"),
            re.compile(r"\bmat\s+tai\s+nhot\b.{0,35}\bchan\s+tay\s+lanh\s+toat\b"),
        ),
    ),
    EmergencyRule(
        category="heatstroke",
        label_vi="say nắng nặng hoặc sốc nhiệt",
        sub_type="heatstroke",
        phrases=(
            "say nang nang",
            "soc nhiet",
        ),
        patterns=(
            re.compile(
                r"\b(?:nang gat|di nang|ngoai nang|say nang).{0,90}"
                r"(?:sot|nong ran|lo mo|lan lon|dau dau du doi|ngat)\b"
            ),
            re.compile(r"\bsot\s+nong\s+ran\b.{0,55}\b(?:lo mo|lan lon|da kho do)\b"),
        ),
    ),
    EmergencyRule(
        category="severe_burn",
        label_vi="bỏng nặng diện rộng",
        sub_type="scald_burn",
        phrases=(
            "bong nuoc soi",
            "bong nang",
            "bong dien rong",
            "bong lua",
            "da phong rop",
        ),
        patterns=(
            re.compile(r"\bnuoc\s+soi\b.{0,35}\b(?:do|doi|vao|bong|phong rop)\b"),
            re.compile(r"\bphong\s+rop\b.{0,25}\b(?:bong troc|dau rat|nuoc soi|bong)\b"),
        ),
    ),
    EmergencyRule(
        category="severe_asthma",
        label_vi="cơn hen cấp nặng hoặc suy hô hấp",
        sub_type="severe_asthma",
        phrases=(
            "tho co keo",
            "co keo hom uc",
            "con hen cap",
            "hen nang",
            "mong tay tim",
            "tim mong tay",
            "moi tim",
        ),
        patterns=(
            re.compile(r"\bhen\s+suyen\b.{0,35}\b(?:du doi|nang|cap|len con|co keo)\b"),
            re.compile(r"\b(?:mong tay|moi|mat may)\b.{0,25}\b(?:tim tai|tim lai|tim ngat)\b"),
        ),
    ),
    EmergencyRule(
        category="acute_vision_loss",
        label_vi="mất thị lực đột ngột",
        sub_type="acute_vision_loss",
        phrases=(
            "mat han thi luc",
            "mat thi luc dot ngot",
            "man den che kin",
            "mu dot ngot",
        ),
        patterns=(
            re.compile(r"\b(?:mat|thi luc)\b.{0,30}\b(?:toi sam.{0,15}mat han|mat han thi luc|man den che kin)\b"),
        ),
    ),
    EmergencyRule(
        category="difficulty_breathing",
        label_vi="khó thở hoặc ngạt thở",
        sub_type="default",
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
            "tho hut hoi",
            "hut hoi qua",
            "hut hoi nang",
            "kho khe du doi",
            "tho kho khe",
            "shortness of breath",
        ),
    ),
    EmergencyRule(
        category="fainting",
        label_vi="ngất xỉu hoặc mất ý thức",
        sub_type="default",
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
            "toi sam mat mui",
            "xay xam mat may",
            "say sam mat may",
            "fainting",
            "passed out",
        ),
    ),
    EmergencyRule(
        category="severe_fall",
        label_vi="té ngã nặng hoặc chấn thương sau ngã",
        sub_type="default",
        phrases=(
            "te nga",
            "bi nga",
            "vap nga",
            "truot nga",
            "truot chan nga",
            "truot te",
            "nga dap dau",
            "te dap dau",
            "dau dap xuong",
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
        category="severe_bleeding",
        label_vi="chảy máu nhiều hoặc xuất huyết",
        sub_type="default",
        phrases=(
            "chay mau nhieu",
            "chay mau cam nhieu",
            "chay mau khong cam",
            "mau chay khong cam",
            "chay mau o at",
            "mau chay nhieu",
            "xuat huyet",
            "ho ra mau",
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
    "severe_headache": ("dau dau du doi", "nhuc dau du doi", "dau buot nua dau du doi"),
    "numbness_weakness": ("te tay", "te chan", "yeu tay", "yeu chan", "mat thang bang"),
    "vision_change": ("nhin mo dot ngot", "mo mat dot ngot", "nhin doi"),
    "confusion": ("lo mo", "me man", "mat dinh huong", "lan lon"),
    "palpitations": ("tim dap nhanh", "hoi hop danh trong nguc", "tim dap loan xa"),
    "high_fever": ("sot cao", "sot nong ran"),
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
    "neg_dung_guard",
    "neg_tranh_guard",
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
    "neg_tranh_guard bi",
    "tim hieu ve",
    "tim hieu dau hieu",
    "dau hieu nhan biet",
    "nguyen nhan cua",
    "nguyen tac so cuu",
    "kien thuc ve",
    "so dien thoai cap cuu",
    "goi so nao",
    "goi so dien thoai khan cap nao",
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
    "nhung nay khoe roi",
    "nay khoe han roi",
    "da khoi han",
    "da hoi phuc",
    "khong tai phat",
)

HISTORICAL_TIME_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Only distant historical (weeks/months/years), NEVER minutes/hours (EP-02).
    re.compile(
        r"\bcach day (?:\d+|vai|may|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|nhieu)\s+(?:tuan|thang|nam)\b"
    ),
    re.compile(
        r"\b(?:tu\s+)?(?:\d+|vai|may|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|nhieu)\s+(?:tuan|thang|nam)\s+truoc\b"
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
    "trong truong hop",
)

HYPOTHETICAL_CONDITIONAL_MARKERS: tuple[str, ...] = (
    "neu",
    "truong hop",
    "khi bi",
    "nho",
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
    "ra sao",
    "goi ai",
    "bao ai",
    "thi nen",
    "thi goi",
    "thi phai",
    "phai lam gi",
    "chuan bi gi",
)

# EP-02: Ongoing, worsening, or same-day/hours-ago symptoms NEVER downgrade to HISTORICAL.
ACTIVE_CURRENT_OVERRIDE_MARKERS: tuple[str, ...] = (
    "dang",
    "hien tai",
    "hien nay",
    "bay gio",
    "luc nay",
    "ngay luc nay",
    "hom nay",
    "sang nay",
    "trua nay",
    "chieu nay",
    "toi nay",
    "dem nay",
    "vua moi",
    "vua bi",
    "vua roi",
    "moi day",
    "moi bi",
    "moi an",
    "tu dung",
    "tu nhien",
    "nay gio",
    "tu sang",
    "tu trua",
    "tu toi qua",
    "may tieng nay",
    "vai tieng truoc",
    "tieng truoc",
    "gio truoc",
    "phut truoc",
    "van con",
    "van dau",
    "van bi",
    "van thay",
    "van kho tho",
    "chua do",
    "khong do",
    "khong giam",
    "nang hon",
    "tang len",
    "lai bi",
    "lai dau",
    "lai thay",
    "lai len",
    "khong cam",
)

# ---------------------------------------------------------------------------
# Priority 1A: Lethal Herbal Poison / Toxic Substances (ph-om-004)
# ---------------------------------------------------------------------------
TOXIC_POISON_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:ma tien|la ngon|strychnine|aconitine)\b"),
    re.compile(
        r"\b(?:phu tu|o dau)\b.{0,45}\b(?:ruou|ngam|re cay|thuoc|uong|gam|chua|dau|ma tien)\b|"
        r"\b(?:ruou|ngam|re cay|thuoc|uong|gam|chua|dau|ma tien)\b.{0,45}\b(?:phu tu|o dau)\b"
    ),
)

# ---------------------------------------------------------------------------
# Priority 1B: Self-Harm Crisis Detection (ph-es-009)
# ---------------------------------------------------------------------------
SELF_HARM_CRISIS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bsong\s+them\s+ngay\s+nao.{0,30}\b(?:nang ne|met moi|vo nghia|kho so)\b"),
    re.compile(
        r"\b(?:khong muon song|chan song|muon chet|muon ket thuc cuoc doi|"
        r"tu sat|muon tu tu|y dinh tu tu|tu lam hai|lam hai ban than|tu gay hai|"
        r"khong con ly do de song|song chang de lam gi|chet di cho xong|muon bien mat mai mai)\b"
    ),
)

ACCENTED_SELF_HARM_PATTERN: re.Pattern[str] = re.compile(r"\btự\s+tử\b")

# Emotional distress context markers (for post-LLM toxic positivity check, never triggers Pre-LLM bypass alone).
EMOTIONAL_DISTRESS_CONTEXT_RE = re.compile(
    r"\b(?:buon|chanh long|qua doi|da mat|tu ai|phat khoc|nuoc mat|vo dung|nang ne|lo so|nho que|co don)\b"
)

# ---------------------------------------------------------------------------
# Priority 2: Privacy, PII, Impersonation & Credential Rules (ph-pr-001..005)
# ---------------------------------------------------------------------------
PRIVACY_BULK_EXPORT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:xuat|trich xuat|gui|cung cap|in|liet ke)\b.{0,35}\b(?:toan bo|tat ca|danh sach)\b"
        r".{0,55}\b(?:ho ten|cccd|can cuoc|benh an|ho so|nguoi dung|tai khoan|so dien thoai)\b"
    ),
    re.compile(
        r"\b(?:nhan vien bao hiem|quan tri vien|thanh tra|co quan chuc nang)\b"
        r".{0,70}\b(?:xuat|trich xuat|danh sach|cccd|can cuoc|benh an|du lieu|ho so)\b"
    ),
)

PRIVACY_FINANCIAL_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:so the ngan hang|the ngan hang|ma pin|so tiet kiem|ma otp|ma cvv|cvv)\b"
        r".{0,55}\b(?:luu giu|luu giup|luu ho|ghi nho|nho giup|nho ho|doc cho|gui cho|cat giu|giu giup|giu ho|bo nho|an toan|khung chat)\b"
    ),
    re.compile(
        r"\b(?:doc|gui|nhap|luu|luu giu|luu giup|luu ho|ghi nho|nho giup|nho ho|cat giu|giu giup|giu ho)\b.{0,35}"
        r"\b(?:so the ngan hang|the ngan hang|ma pin|so tiet kiem|ma otp|cvv)\b"
    ),
    re.compile(
        r"\bmat khau\b.{0,35}\b(?:luu giu|luu giup|luu ho|ghi nho|cat giu|giu giup|giu ho|bo nho ai)\b"
    ),
    re.compile(
        r"\b(?:ma pin|ma otp)\s+\d{4,8}\b|\bso the ngan hang\b.{0,15}\d{4}"
    ),
)

PRIVACY_PASSWORD_LOOKUP_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:tra|xem|doc|cho|gui|tim|lay|hoi|cung cap)\b.{0,65}\b(?:mat khau|password)\b"),
    re.compile(r"\bmat khau\s+(?:dang nhap|tai khoan|cua|la gi)\b"),
)

PRIVACY_THIRD_PARTY_ACCESS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:mo|doc|xem|tra|kiem tra|cho biet|cung cap)\b.{0,35}"
        r"\b(?:ho so|tai khoan|don thuoc|huyet ap|suc khoe|lich su|so dien thoai|dia chi)\b"
        r".{0,30}\bcua\s+(?:cu|ong|ba|bac|anh|chi|co|chu|con|nguoi khac|hang xom)\b"
    ),
    re.compile(
        r"\b(?:ke lai|doc lai|xem lai|cho nghe|cho xem)\b.{0,40}"
        r"\b(?:hoi thoai|doan hoi thoai|tam su|chuyen buon|tin nhan|tro chuyen)\b"
        r".{0,35}\b(?:cua|rieng cua)\s+(?:cu|ong|ba|bac|anh|chi|nguoi khac)\b"
    ),
    re.compile(
        r"\b(?:xem|doc|cho biet)\b.{0,25}\b(?:cu ay|ong ay|ba ay|bac ay|nguoi khac)\b"
        r".{0,35}\b(?:uong.{0,15}thuoc gi|huyet ap|benh gi)\b"
    ),
)

# ---------------------------------------------------------------------------
# Priority 3: Medication Safety Rules (Ordered: ADR -> Pill ID -> Crush -> Missed -> Specialized -> Generic)
# ---------------------------------------------------------------------------
NEW_MEDICATION_ADR_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:thuoc.{0,25}moi|doi sang.{0,25}thuoc|sau khi uong thuoc|uong thuoc.{0,20}xong|uong xong)\b"
        r".{0,70}\b(?:noi man|man ngua|phat ban|ngua khap|di ung|buon non|noi me day|tac dung phu)\b"
    ),
    re.compile(
        r"\b(?:noi man|man ngua|phat ban|noi me day)\b.{0,60}\b(?:thuoc|lieu chieu|uong not|uong tiep)\b"
    ),
)

FRAGMENTED_STT_DOSAGE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\.\.\..{0,40}\b(?:hop|thuoc|vien)\b.{0,40}\buong\s+may\b"),
    re.compile(r"\b(?:hop|thuoc|vien)\b.{0,35}\buong\s+may\s*(?:\.\.\.|$)"),
)

UNIDENTIFIED_PILL_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:vien thuoc|nua vien|vien nang|vien mau)\b.{0,55}"
        r"\b(?:mau\s+(?:hong|vang|trang|cam|xanh|do|nau|tim|bac)|hinh\s+(?:bau duc|tam giac|tron|vuong)|khong con vo|mat nhan|mat chu)\b"
        r".{0,70}\b(?:la thuoc gi|thuoc.{0,15}hay thuoc|tri benh gi|uong.{0,20}(?:luc nao|truoc hay sau an|luc doi|may vien|bao nhieu)|uong luon)\b"
    ),
    re.compile(
        r"\b(?:vien thuoc|nua vien|vien nang)\b.{0,45}\bmau\s+(?:hong|vang|trang|cam|xanh|do|nau|tim|bac)\b"
        r".{0,45}\b(?:uong|thuoc gi|benh gi)\b"
    ),
    re.compile(
        r"\bvi thuoc\b.{0,45}\b(?:cat roi|mat chu|mat nhan|khong con vo)\b"
    ),
    re.compile(
        r"\bvi\s+(?:thuoc\s+)?chu\s+(?:bac|xanh|trang|do)\b.{0,80}\b(?:buoi sang|buoi toi|thuoc gi|vi nao)\b"
    ),
)

TABLET_CRUSHING_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:gia nat|nghien nho|nghien nat|be doi|be vun|cat doi|ca nat)\b.{0,35}"
        r"\b(?:vien|thuoc|boc duong|bao phim|pha nuoc)\b"
    ),
    re.compile(
        r"\b(?:vien thuoc|vien boc duong|vien bao phim|vien nang)\b.{0,45}"
        r"\b(?:gia nat|nghien nho|nghien nat|be doi|be vun)\b"
    ),
)

MISSED_OR_UNCERTAIN_DOSE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:uong dai|uong bu|uong gop|uong gap doi|gop.{0,25}lieu|don lieu|"
        r"thanh\s+(?:hai|2|ba|3)\s+vien\s+uong)\b"
    ),
    re.compile(
        r"\b(?:quen|khong nho|lo denh)\b.{0,40}\b(?:uong|lieu|cu thuoc)\b"
        r".{0,55}\b(?:uong dai|uong bu|uong them|uong mot vien|uong hai vien|gop|vien)\b"
    ),
)

EXPIRED_MEDICATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:thuoc|vien|vi|hop thuoc)\b.{0,65}\b(?:qua han|het han)\b.{0,55}\b(?:uong|dung|co sao khong|chua moc)\b"
    ),
    re.compile(r"\b(?:qua han|het han)\b.{0,35}\b(?:thuoc|vien|uong tiep|dung tiep)\b"),
)

PRESCRIPTION_SHARING_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:ke rieng cho|dung chung thuoc|lay\s+(?:mot|1|nua|hai|2)\s+vien\s+cua\s+(?:ba|ong|vo|chong|nguoi khac)|"
        r"uong thuoc\s+(?:ke rieng\s+)?cua\s+(?:ba|ong|vo|chong|nguoi khac))\b"
    ),
)

ALCOHOL_MEDICATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:ruou|ruou thuoc|bia)\b.{0,65}\b(?:uong thuoc|cu thuoc|thuoc tieu duong|thuoc huyet ap|uong lien)\b"
    ),
    re.compile(
        r"\b(?:cu thuoc|thuoc tieu duong|thuoc huyet ap)\b.{0,55}\b(?:ruou|ruou thuoc|bia)\b"
    ),
)

PERIOPERATIVE_ANTICOAGULANT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:thuoc chong dong|chong dong mau)\b.{0,65}\b(?:mo|phau thuat|ngung|stop_dung_verb|may hom|may ngay)\b"
    ),
    re.compile(
        r"\b(?:mo|phau thuat)\b.{0,55}\b(?:thuoc chong dong|chong dong mau)\b"
    ),
)

RENAL_LAB_PRESCRIPTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:creatinine|egfr)\b.{0,65}\b(?:ke|phac do|lieu luong|mua uong|dieu tri)\b"),
)

FOLK_REPLACEMENT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:bo thuoc|ngung thuoc|thay thuoc)\b.{0,45}\b(?:vien hoan|gia truyen|quang cao|tren mang|chuyen sang)\b"
    ),
)

# ---------------------------------------------------------------------------
# Priority 4: Diagnosis & Specialist Procedure Override (ph-om-001, ph-om-005)
# ---------------------------------------------------------------------------
THYROID_IMAGING_DIAGNOSIS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:tirads|birads|nhan tuyen giap|nhan thuy phai|nhan thuy trai)\b.{0,70}\b(?:ket luan|u lanh|ung thu|phai mo|cat toan bo)\b"),
)

SPECIALIST_OVERRIDE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:phan quyet|bo chi dinh|huy chi dinh|khong can dat may|khong can mo|khong can phau thuat)\b"
        r".{0,55}\b(?:dat may|may tao nhip|phau thuat|thuoc bo|bac si|la du)\b"
    ),
    re.compile(
        r"\b(?:dat may tao nhip|may tao nhip)\b.{0,70}\b(?:khong can|thay bang|chi uong thuoc bo|phan quyet)\b"
    ),
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
    re.compile(r"\bket luan\b.{0,60}\b(?:benh|bi gi|mac gi|co phai|u lanh|ung thu|ac tinh)\b"),
    re.compile(
        r"\b(?:co phai|lieu co phai)\b.{0,30}\b(?:bi|mac|benh|suy tim|tieu duong|huyet ap|viem phoi|tai bien|dot quy|gan|than|khop|ung thu|roi loan)\b"
    ),
    re.compile(
        r"\b(?:xem giup|kham giup|doan xem|theo chau)\b.{0,50}\b(?:bi gi|benh gi|chung gi|lam sao|co phai)\b"
    ),
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
    re.compile(r"\bke\s+(?:giup|ho|cho)\b.{0,35}\b(?:thuoc|don|phac do)\b"),
    re.compile(r"\b(?:cho|goi y|tu van)\b.{0,25}\b(?:uong|mua|dung)\s+thuoc\s+(?:gi|nao)\b"),
    re.compile(r"\b(?:tang|giam|chinh|thay doi|doi)\s+(?:lieu|luong thuoc|sang thuoc|sang loai thuoc)\b"),
    re.compile(
        r"\b(?:tu\s+)?(?:tang|giam)\s+(?:len|xuong)\s+(?:\d+|mot|hai|ba|bon|nam|nua)\s*(?:vien|lieu)\b"
    ),
    re.compile(
        r"\b(?:uong|dung)\s+(?:(?:ngay|moi ngay|buoi sang|buoi toi|lan)\s+)?"
        r"(?:gap doi|them\s+(?:(?:\d+|mot|hai|ba|bon|nam|nua)\s+)?vien|may vien|bao nhieu vien|nua vien|bu lieu|don lieu)\b"
    ),
    re.compile(
        r"\b(?:bo bot|giam bot|uong bot|be doi|chia doi|be nua|uong nua|con nua)\b.{0,20}\b(?:vien|lieu|thuoc|huyet ap|tieu duong)\b"
    ),
    re.compile(
        r"\b(?:tu y\s+)?(?:bo|ngung|tu bo|nghi uong|tam ngung|tam dung)\s+(?:uong\s+)?(?:thuoc|vien|lieu|cu thuoc|huyet ap|tieu duong)\b"
    ),
)

# Accent-sensitive pattern on lowercased NFC text so "dừng thuốc" (stop) triggers while "dùng thuốc" (use) does not.
ACCENTED_STOP_MEDICATION_PATTERN: re.Pattern[str] = re.compile(
    r"\b(?:dừng|ngừng)\s+(?:uống\s+)?(?:thuốc|liều|viên)\b"
)

MEDICATION_STATUS_QUERY_PHRASES: tuple[str, ...] = (
    "da uong thuoc chua",
    "uong thuoc chua",
    "sang nay uong chua",
    "toi nay uong chua",
    "hom nay uong thuoc chua",
    "uong lieu nay chua",
)

# Expanded for ph-ms-012 (allows up to 65 chars & "uong xong" / "vua uong").
UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:xac nhan|ghi nhan|danh dau|cap nhat|luu|coi nhu|bo sung)\b"
        r".{0,65}\b(?:da uong|uong roi|uong xong|vua uong)\b"
    ),
)

# Priority 5: Telephony / Messaging capability requests (ph-es-003).
TELEPHONY_ACTION_REQUEST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:bam may|goi dien|goi dien thoai|ket noi cuoc goi|nhan tin|gui tin nhan|gui zalo|nhan zalo)\b"
        r".{0,40}\b(?:truc tiep|giup|ho|thay|ngay bay gio|cho\s+(?:con|nguoi than|gia dinh|hang xom|bac si))\b"
    ),
    re.compile(r"\bchau\s+(?:bam may|goi dien|nhan tin|gui zalo)\b"),
)

# ---------------------------------------------------------------------------
# Post-LLM Deterministic Validation Patterns (Block-or-Safe-Replace)
# ---------------------------------------------------------------------------

_DIGIT_QTY = r"\d+(?:[.,/\-]\d+)?"
_WORD_QTY = (
    r"(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|nua|ruoi|"
    r"gap\s+doi|gap\s+ba|mot\s+nua|mot\s+ruoi|hai\s+ruoi|vai|them\s+(?:mot|hai|nua))"
)
_ANY_QTY = rf"(?:{_DIGIT_QTY}|{_WORD_QTY})"
_DOSAGE_UNIT = r"(?:(?<!cong )(?<!nhan )(?<!benh )vien|goi|ong|giot|ml|mg|mcg|gam|ui|iu|lieu|mui|nhat\s+xit|thia|muong)"

# 1) Emergency Delay Patterns (EP-03, EP-04, EP-05)
POST_LLM_EMERGENCY_DELAY_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "watchful_waiting_after_minutes",
        re.compile(
            r"\b(?:sau|khoang)\s+(?:\d+(?:\s*-\s*\d+)?|vai|mot vai|it|nam|muoi|muoi lam)\s*(?:phut|gio|tieng)\b"
        ),
    ),
    (
        "watchful_waiting_wait_duration",
        re.compile(
            r"\b(?:cho|doi|nam cho|nghi cho|nam nghi|theo doi them|theo doi tai nha)\s+"
            r"(?:them\s+)?(?:khoang\s+)?(?:\d+(?:\s*-\s*\d+)?|vai|mot vai|mot luc|it|nam|muoi|muoi lam)?\s*"
            r"(?:phut|gio|tieng|ngay|xem sao|xem|den)\b"
        ),
    ),
    (
        "watchful_waiting_until_tomorrow",
        re.compile(r"\b(?:cho|doi|ngu|de)\s+(?:den|toi)\s+(?:sang mai|bua trua|ngay mai|sang)\b"),
    ),
    (
        "watchful_waiting_see_if_resolves",
        re.compile(
            r"\b(?:xem co tu het khong|xem co do khong|xem co thuyen giam khong|"
            r"xem co tu khoi khong|xem co cam mau khong|xem co ngat lan nua khong|"
            r"xem mat co sang lai khong|xem than nhiet co tu ha khong|xem vet bong co tu khoi)\b"
        ),
    ),
    (
        "conditional_115_delay",
        re.compile(
            r"\b(?:neu|chi goi 115 neu)\b.{0,45}\b(?:khong do|khong giam|khong thuyen giam|khong het|nang hon|van tuc nguc)\b"
            r".{0,35}\b(?:115|cap cuu|di vien|di kham)\b"
        ),
    ),
)

# Medical/emergency cue used to gate "sau X phút" so non-medical tea brewing does not FP.
POST_LLM_MEDICAL_CONTEXT_CUE_RE = re.compile(
    r"\b(?:trieu chung|dau|tuc nguc|kho tho|chong mat|ngat|sot|non|bong|chay mau|"
    r"115|cap cuu|benh vien|di kham|thuyen giam|khong do|vet bong|hen|mat|huyet ap|duong huyet|benh)\b"
)

# 2) 12 Unsafe First-Aid Maneuvers (Global, never excused by '115' — EP-04)
POST_LLM_UNSAFE_FIRST_AID_PATTERNS: tuple[tuple[str, str, re.Pattern[str]], ...] = (
    ("folk_raise_left_arm", "chest_pain", re.compile(r"\b(?:giu|gio|nang|dua)\s+tay\s+trai(?:\s+len)?\b")),
    ("folk_finger_prick_bleeding", "stroke", re.compile(r"\b(?:chich|trich|nan)\s+mau\b")),
    (
        "folk_acupressure_coining",
        "stroke",
        re.compile(
            r"\b(?:bam huyet|cao gio|danh cam|vat chanh)\b|"
            r"(?<!cam )\bgiac hoi\b(?!\s+hop)|"
            r"\ban cung nguu(?:\s+hoang)?\b|\b(?:uong|dung|vien)\s+an cung\b"
        ),
    ),
    (
        "folk_burn_topicals",
        "scald_burn",
        re.compile(
            r"\b(?:boi|dap|xuc)\s+(?:kem danh rang|nuoc mam|mo|dau an|long trang trung|da lanh)\b|"
            r"\bchoc\s+vo\s+bong\s+nuoc\b"
        ),
    ),
    (
        "folk_choking_maneuver",
        "choking",
        re.compile(r"\b(?:nuot(?:\s+mieng)?\s+com|nuot\s+chuoi|moc\s+hong|moc\s+sau\s+vao\s+co\s+hong|uong\s+nhieu\s+nuoc\s+cho\s+troi)\b"),
    ),
    (
        "unsafe_eye_manipulation",
        "acute_vision_loss",
        re.compile(r"\b(?:dui mat|dui vao mat|day an vao nhan cau|an vao mat|day mat|nho thuoc nho mat)\b"),
    ),
    ("unsafe_self_driving_emergency", "default", re.compile(r"\b(?:tu lai xe|tu di mot minh|tu di bo den phong kham)\b")),
    ("unsafe_stand_up_after_fall", "default", re.compile(r"\b(?:co dung day|tu dung day di|tu dung len)\b")),
    ("unsafe_lie_flat_asthma", "severe_asthma", re.compile(r"\bnam\s+ngua\s+phang\b")),
    ("unsafe_heatstroke_blanket_or_antipyretic", "heatstroke", re.compile(r"\b(?:dap chan kin|uong thuoc ha sot|uong paracetamol)\b")),
    ("unsafe_force_oral_intake", "gi_bleeding", re.compile(r"\b(?:do nuoc vao mieng|ep uong nuoc|uong sua nong|chuom nong vung bung)\b")),
    ("folk_chest_thump", "chest_pain", re.compile(r"\bvo\s+nguc\b")),
)

# 3) Post-LLM Diagnosis & Specialist Override Patterns
POST_LLM_DIAGNOSIS_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:chan doan|ket luan)\s+(?:la|bac bi|ong bi|ba bi|cu bi|ban bi)\b"),
    re.compile(
        r"\b(?:chan doan|ket luan|khang dinh|chac chan)\s+(?:la\s+|rang\s+)?(?:bac|ong|ba|cu|ban)?\s*"
        r"(?:da\s+)?(?:bi|mac)\s+(?:benh\s+)?[a-z0-9\s]{2,35}\b"
    ),
    re.compile(
        r"\b(?:chan doan|ket luan|khang dinh|chac chan)\s+(?:la\s+|rang\s+)?(?:bac|ong|ba|cu|ban)?\s*"
        r"(?:da\s+)?(?:bi|mac|la)?\s*(?:benh\s+)?"
        r"(?:ung thu|u lanh|u ac|suy than|tram cam|sa sut tri tue|alzheimer|viem khop|thoai hoa khop|"
        r"di ung thuoc|cam cum|thieu mau|suy nhuoc|tim mach|dot quy|tieu duong|cao huyet ap|suy tim|viem phoi)\b"
    ),
    re.compile(r"\b(?:bac|ong|ba|cu|ban)\s+(?:chac chan\s+|da\s+)?(?:mac|bi)\s+benh\s+[a-z0-9\s]{2,30}"),
    re.compile(
        r"\b(?:bac|ong|ba|cu|ban)\s+(?:chac chan\s+|da\s+)?(?:bi|mac)\s+"
        r"(?:ung thu tuyen giap|suy than|tram cam lam sang|alzheimer|sa sut tri tue|viem khop|thoai hoa khop|di ung thuoc)\b"
    ),
    re.compile(r"\bchac chan (?:la )?(?:benh|viem|tieu duong|cao huyet ap|suy tim|ung thu|u lanh|u ac|tram cam|di ung thuoc)\b"),
    re.compile(
        r"\b(?:cam ket|bao dam)\s+(?:100%|thanh cong 100%|ket qua 100%)|"
        r"\b(?:cam ket|bao dam|chac chan)\s+(?:thanh cong 100%|mat se sang hoan toan\b|hoi phuc hoan toan\b|khoi han\b)"
    ),
    re.compile(
        r"\b(?:khong can dat may tao nhip|chi can uong thuoc bo tim la du|bo chi dinh dat may|"
        r"huy lich mo|phai mo cat toan bo tuyen giap|khong can lam xet nghiem gi them)\b"
    ),
)

# 4) Post-LLM Dosage, Prescribing, Modification & Speculation Patterns
POST_LLM_DOSAGE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:hay|nen|co the|cu|phai)\s+(?:tu\s+)?(?:tang|giam|chinh)\s+(?:lieu|len|xuong)\b"),
    re.compile(
        rf"\b(?:hay|nen|co the|cu|phai|uong|uong bu|uong them|uong dai|uong thu|tang len|giam xuong|be|chia|tiem|pha)\s+"
        rf"(?:uong\s+|dung\s+|them\s+|tam\s+|dai\s+|thu\s+|khoang\s+|tu\s+|ngay\s+|moi ngay\s+|moi lan\s+|con\s+)?"
        rf"{_ANY_QTY}(?:\s*(?:den|toi|-)\s*{_ANY_QTY})?\s*{_DOSAGE_UNIT}\b"
    ),
    re.compile(
        rf"\b(?:moi ngay|ngay|moi lan|buoi sang|buoi trua|buoi toi)\s+"
        rf"(?:uong\s+|dung\s+)?{_ANY_QTY}(?:\s*(?:den|toi|-)\s*{_ANY_QTY})?\s*{_DOSAGE_UNIT}\b"
    ),
    re.compile(
        r"\b(?:co the|nen|hay|cu|dong y|phai)?\s*(?:uong gap doi|uong gop|uong bu|"
        r"(?<!ngung )(?<!stop_dung_verb )uong them thuoc|uong dai|uong thu vien|tang lieu|giam lieu|chinh lieu)\b"
    ),
    # ph-ms-007 exemption: bo thuoc(?!\s+(?:qua han|het han|bi moc|doi mau))
    re.compile(
        r"\b(?:co the|nen|hay|cu|dong y|tam|phai)?\s*(?:ngung thuoc|ngung uong|"
        r"bo thuoc(?!\s+(?:qua han|het han|bi moc|doi mau))|nghi uong|bo lieu|bo cu thuoc|doi cu thuoc|"
        r"doi sang thuoc|stop_dung_verb\s+(?:uong\s+)?thuoc)\b"
    ),
    re.compile(r"\b(?:chau|toi)\s+(?:ke don|ke thuoc|cho (?:bac|ong|ba|cu) uong)\b"),
    re.compile(
        r"\b(?:co the|nen|hay|cu|dong y)?\s*(?:gia nat|nghien nho|nghien nat|be doi|be nua)\s+(?:vien|thuoc)\b"
    ),
    re.compile(
        r"\b(?:thuoc\s+)?(?:qua han|het han).{0,40}\b(?:van uong duoc|uong tiep duoc|van dung duoc|khong sao)\b"
    ),
    re.compile(
        r"\b(?:co the|nen|hay|cu|dong y)\s+(?:dung chung thuoc|"
        r"uong(?:\s+thu)?\s+thuoc(?:\s+[a-z0-9\s]{0,25})?\s+cua\s+(?:ba|ong|vo|chong|nguoi khac|bac|cu)|"
        r"lay\s+(?:mot|1|nua|hai|2)\s+vien(?:\s+thuoc)?(?:\s+[a-z0-9\s]{0,25})?\s+cua\s+(?:ba|ong|vo|chong|nguoi khac|bac|cu))\b"
    ),
    re.compile(
        r"\b(?:chuyen sang|thay bang)\s+(?:vien hoan|bai thuoc gia truyen|nuoc la du du)\b|"
        r"\bchua dut diem tieu duong\b|"
        r"\buong ruou thuoc.{0,35}\b(?:hoan toan vo hai|an toan|khong sao)\b"
    ),
    re.compile(
        r"\b(?:ke don|ke thuoc|ke phac do|nen mua|nen uong|cu uong|hay uong|co the uong)\s+"
        r"(?:thuoc\s+)?(?:khang sinh|giam dau|khang viem|gian co|an than|thuoc ngu|chong tram cam|"
        r"khang histamin|thuoc bo tim|thuoc ha ap|thuoc ha duong huyet|thuoc nho mat)\b"
    ),
)

POST_LLM_COMMON_DRUG_NAMES_RE = re.compile(
    r"\b(?:amlodipine|atorvastatin|losartan|metformin|omeprazole|paracetamol|simvastatin|"
    r"ibuprofen|aspirin|bisoprolol|glimepiride|lisinopril|rosuvastatin|clopidogrel|"
    r"pantoprazole|esomeprazole|amoxicillin|diclofenac|meloxicam|celecoxib|diazepam|"
    r"seduxen|cetirizin|loratadin|prednisolon)\b"
)

POST_LLM_CONCRETE_STRENGTH_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|ml|ui|iu)\b"
)

POST_LLM_DIRECTIVE_MED_VERB_RE = re.compile(
    r"\b(?:nen|hay|cu|co the|phai|uong ngay|uong bu|uong them|uong dai|uong gap doi|uong gop|"
    r"tang|giam|bo lieu|ngung|stop_dung_verb|gia nat|nghien|be doi|chia doi)\b"
)

POST_LLM_PILL_SPECULATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:vien\s+thuoc|thuoc(?:\s+mau\s+[a-z]+)?|vien\s+nang|manh\s+vi|vi\s+thuoc|vien\s+mau|nua\s+vien).{0,65}"
        r"\b(?:co the la|thuong la|kha nang la|chac la|co ve la|la thuoc)\s+"
        r"(?:thuoc\s+)?(?:dieu tri\s+)?(?:huyet ap|tieu duong|mo mau|da day|tim mach|xuong khop|"
        r"khang sinh|giam dau|dau ca|linh chi|nhan sam|thuoc bo|vitamin|an than|"
        r"amlodipine|atorvastatin|losartan|metformin|omeprazole|paracetamol|simvastatin|ibuprofen|aspirin)\b"
    ),
    re.compile(
        r"\b(?:co the la|thuong la|kha nang la|chac la|co ve la|la thuoc)\s+"
        r"(?:thuoc\s+)?(?:amlodipine|atorvastatin|losartan|metformin|omeprazole|paracetamol|simvastatin|"
        r"ibuprofen|aspirin|bisoprolol|glimepiride|lisinopril|rosuvastatin|clopidogrel|diazepam|seduxen)\b"
    ),
    re.compile(
        r"\b(?:thuong\s+)?(?:uong|dung)\s+(?:truoc\s+hoac\s+sau\s+an|sau\s+hoac\s+truoc\s+an|truoc\s+an|sau\s+an|luc\s+doi|luc\s+no)\b|"
        r"\bvi\s+chu\s+(?:bac|xanh)\s+(?:uong|la)\s+(?:buoi\s+sang|buoi\s+toi)\b"
    ),
)

POST_LLM_ANTIHISTAMINE_RE = re.compile(
    r"\b(?:khang histamin|chong di ung|loratadin|cetirizin|clorpheniramin|diphenhydramin|fexofenadin|thuoc boi di ung|thuoc di ung)\b"
)

POST_LLM_TOXIC_HERBAL_RECIPE_RE = re.compile(
    r"\b(?:ngam|ty le|cong thuc|moi lan)\b.{0,50}\b(?:\d+\s*(?:g|gam|gram|lang|ml|lit)|ma tien|phu tu)\b"
    r".{0,50}\b(?:\d+\s*(?:g|gam|gram|lang|ml|lit)|ruou|chen|ly)\b"
)

POST_LLM_ANTICOAGULANT_DAYS_RE = re.compile(
    r"\b(?:ngung|stop_dung_verb|bo|uong lai|dung lai)\s+(?:thuoc\s+chong\s+dong\s+)?(?:truoc|sau)?\s*"
    r"(?:ngay\s+mo\s+|mo\s+|phau thuat\s+)?(?:\d+|mot|hai|ba|bon|nam|sau|bay)(?:\s*-\s*\d+)?\s*(?:ngay|hom)\b"
)

POST_LLM_APP_LOG_DEFINITIVE_PROOF_RE = re.compile(
    r"\b(?:trang thai tren ung dung|ung dung\s+(?:da\s+)?ghi|he thong\s+(?:da\s+)?ghi|"
    r"nhat ky\s+(?:tren\s+)?(?:app|ung dung)|app\s+(?:da\s+)?ghi).{0,65}"
    r"(?:\bbang chung chac chan\b|\bchac chan\s+100%|\bchac chan\s+(?:(?:ong|ba|cu|bac)\s+)?da\s+uong\b|"
    r"\bkhang dinh\s+(?:(?:ong|ba|cu|bac)\s+)?da\s+uong\b|\bbang chung tuyet doi\b)|"
    r"\b(?:ong|ba|cu|bac)\s+chac chan\s+(?:100%\s+)?da\s+uong\s+thuoc\b|"
    r"\bchac chan\s+100%\s+(?:ong|ba|cu|bac)\s+da\s+uong\s+thuoc\b"
)

POST_LLM_TAKEN_CLAIM_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:bac|ong|ba|cu|ban)?\s*(?:da\s+uong|da\s+dung)\s+(?:thuoc|lieu)(?:\s+[a-z0-9\-\s]{0,30})?(?:\s+roi|\s+hom nay|\s+sang nay|\s+toi nay)?\b"
    ),
    re.compile(
        r"\b(?:da\s+ghi\s+nhan|da\s+xac\s+nhan|da\s+danh\s+dau|da\s+cap\s+nhat)\s+"
        r"(?:trang thai\s+|la\s+)?(?:uong\s+thuoc|da\s+uong|uong\s+xong)\b"
    ),
    re.compile(r"\bhoan thanh lieu thuoc\b"),
)

# 5) Post-LLM Privacy & PII Leakage Patterns
POST_LLM_VN_PHONE_RE = re.compile(r"(?<!\d)(?:\+?84[\s.\-]?|0)(?:3|5|7|8|9)(?:[\s.\-]?\d){8}(?!\d)")
POST_LLM_CCCD_RE = re.compile(r"(?<!\d)(?:\d{9}|\d{12})(?!\d)")
POST_LLM_BANK_CARD_RE = re.compile(r"(?<!\d)(?:\d[\s\-]?){13,19}(?!\d)")

POST_LLM_PRIVACY_CREDENTIAL_SOLICIT_RE = re.compile(
    r"\b(?:hay|cu|nen|co the|vui long)?\s*(?:gui|doc|nhap|cung cap|cho chau biet|luu giu|ghi nho|cat giu)\b.{0,45}"
    r"\b(?:mat khau|ma otp|otp|ma pin|so the ngan hang|the ngan hang|cccd|can cuoc cong dan|so tai khoan)\b"
)
POST_LLM_PRIVACY_STORAGE_PROMISE_RE = re.compile(
    r"\b(?:chau|toi|ai)\s+(?:se|co the)\s+(?:ghi nho|luu giu|cat giu)\b.{0,35}\b(?:ma pin|mat khau|the ngan hang|otp|cccd)\b|"
    r"\ban toan\s+(?:de|khi)\s+(?:gui|doc|luu)\s+(?:ma pin|mat khau|so the|otp)\b"
)
POST_LLM_PRIVACY_OTHER_USER_LEAK_RE = re.compile(
    r"\b(?:cu mai|tran thi mai|bac ba|nguyen van ba|con gai ong)\b.{0,65}"
    r"\b(?:dang uong|uong thuoc|amlodipine|metformin|losartan|huyet ap la|tam su rang|ke rang|"
    r"so dien thoai la|dia chi la|mat khau la|co ho so|dang dung ung dung mimamori)\b|"
    r"\b(?:de chau|chau se)\s+(?:tra cuu|mo ho so|xem ho so|kiem tra tai khoan)\s+(?:cua|ho)\b"
)
POST_LLM_PRIVACY_BULK_OR_INSURER_RE = re.compile(
    r"\b(?:xuat danh sach|trich xuat du lieu nguoi dung|danh sach ho ten.{0,20}cccd|"
    r"xac nhan tu cach nhan vien bao hiem|gui danh sach cho nhan vien bao hiem|cung cap du lieu cho bao hiem)\b"
)
POST_LLM_PRIVACY_HASH_CONFUSION_RE = re.compile(
    r"\b(?:ma hoa hai chieu|giai ma de doc lai mat khau|co the giai ma mat khau|doc lai mat khau goc)\b"
)

# 6) Post-LLM Unsupported Capability / Action-Success Claims (ALL 8 Families, receipt=False)
POST_LLM_UNSUPPORTED_CAPABILITY_PATTERNS: tuple[tuple[str, str, re.Pattern[str]], ...] = (
    (
        "false_phone_call_claim",
        "telephony",
        re.compile(
            r"\b(?:chau|toi|ai|ung dung|he thong)\s+(?:co the\s+|se\s+|dang\s+|da\s+|vua\s+)?(?:tu\s+)?"
            r"(?:goi dien(?:\s+qua)?|bam may goi|ket noi cuoc goi|lien lac dien thoai|goi cho\s+(?:con|nguoi than|gia dinh|hoc tro|bac|cu|ong|ba))\b|"
            r"\bde\s+chau\s+goi\s+(?:dien|cho)\b|\bdang\s+ket\s+noi\s+cuoc\s+goi\b"
        ),
    ),
    (
        "false_sms_zalo_notify_claim",
        "telephony",
        re.compile(
            r"\b(?:chau|toi|ai|ung dung|he thong)\s+(?:co the\s+|se\s+|dang\s+|da\s+|vua\s+)?(?:tu dong\s+)?"
            r"(?:nhan tin|gui tin nhan|gui zalo|nhan zalo|gui canh bao phe binh|"
            r"thong bao cho\s+(?:con|nguoi than|gia dinh|bac si)|bao cho\s+(?:con|nguoi than|gia dinh)|"
            r"lien lac voi\s+(?:hoc tro|con chau|nguoi than))\b"
        ),
    ),
    (
        "false_auto_115_dispatch_claim",
        "telephony",
        re.compile(
            r"\b(?:chau|toi|ai|ung dung|he thong)\s+(?:co the\s+|se\s+|dang\s+|da\s+|vua\s+)?(?:tu dong\s+)?"
            r"(?:goi|quay so|dieu xe|ket noi)\s+(?:cap cuu\s+|xe cap cuu\s+)?115\b|"
            r"\bde\s+chau\s+goi\s+(?:cap cuu\s+)?115\b"
        ),
    ),
    (
        "false_db_mutation_claim",
        "medication_log",
        re.compile(
            r"\b(?:chau|toi|ai|he thong)\s+(?:da|vua|se)\s+(?:tu dong\s+)?"
            r"(?:danh dau|cap nhat|luu|ghi nhan|them|doi|sua|lien ket)\s+"
            r"(?:la\s+|trang thai\s+|giup\s+|ho\s+)?(?:da uong|uong xong|lich thuoc|don thuoc|3 loai thuoc|hai tai khoan|tai khoan)\b"
        ),
    ),
    (
        "false_app_settings_control_claim",
        "general",
        re.compile(
            r"\b(?:chau|toi|ai)\s+(?:da|vua|se|co the)\s+(?:tu dong\s+)?"
            r"(?:doi|tang|phong to|giam|chinh|tat|bat|hen gio|dieu khien)\s+"
            r"(?:co chu|toc do doc|giong doc|thong bao|den phong|dai phat thanh|bao thuc|nhac|thiet bi)\b"
        ),
    ),
    (
        "false_checkin_via_chat_claim",
        "general",
        re.compile(
            r"\b(?:chau|toi|ai)\s+(?:da|vua|se)\s+(?:diem danh|gui diem danh|luu diem danh|hoan thanh diem danh)\s*(?:ho|thay|giup|hom nay)?\b"
        ),
    ),
    (
        "false_camera_or_physical_action_claim",
        "general",
        re.compile(
            r"\b(?:chau|toi|ai)\s+(?:co the\s+|dang\s+|da\s+|se\s+)?"
            r"(?:nhin thay.{0,25}(?:camera|hien nha|chu meo|vien thuoc)|"
            r"doc duoc so kham giay|pha tra giup|phu nhat rau|nau bep giup|nau do an giup|nem thu|dat do an giup)\b|"
            r"\bqua\s+camera.{0,30}\b(?:nhin thay|thay ro|quan sat)\b"
        ),
    ),
    (
        "false_vital_signs_or_nonexistent_feature_claim",
        "general",
        re.compile(
            r"\b(?:do huyet ap|do nhip tim|do duong huyet|do nhiet do|xet nghiem mau)\s+(?:qua man hinh|bang camera|bang dien thoai|tu dong)\b|"
            r"\b(?:da|vua|dang|co the|se)\s+do\s+(?:huyet ap|nhip tim|duong huyet|nhiet do|than nhiet)\s+(?:cho\s+(?:bac|ong|ba|cu)|la\s+\d)\b|"
            r"\b(?:cam bien tu dong phat hien te nga|chup anh quet don thuoc|quet ocr don thuoc|quet ma qr lien ket|thu am nen 24/24|nut banh rang tro nang noi)\b"
        ),
    ),
)

# 7) False Reassurance, Toxic Positivity, Output Hygiene (<think>, Reversed Kinship)
FALSE_REASSURANCE_PHRASES: tuple[str, ...] = (
    "khong sao dau",
    "cu yen tam",
    "binh thuong thoi",
    "khong can di kham",
    "khong can di vien",
    "tu khoi thoi",
    "tu het thoi",
    "khong co gi dang lo",
    "ngu mot giac la het",
    "da tinh lai roi thi khong can",
    "phan ung binh thuong",
)

POST_LLM_TOXIC_POSITIVITY_RE = re.compile(
    r"\b(?:phai vui len|co gang vui len|hay vui len|suy nghi tich cuc|"
    r"khong co gi phai buon|co gi dau ma buon|nen noi buon|neg_dung_guard khoc nua|dung khoc nua)\b"
)

POST_LLM_THINK_TAG_RE = re.compile(r"</?think>", re.IGNORECASE)

POST_LLM_REVERSED_KINSHIP_RE = re.compile(
    r"(?:^|[.!?\n]\s*|,\s*)chau\s+oi\b|"
    r"\bchau\s+(?:can|hay|nen)\s+(?:giu|cham soc|dua|goi cho)\s+(?:cu|bac|ong|ba)\b"
)

__all__ = [
    "ACCENTED_SELF_HARM_PATTERN",
    "ACCENTED_STOP_MEDICATION_PATTERN",
    "ACTIVE_CURRENT_OVERRIDE_MARKERS",
    "ALCOHOL_MEDICATION_PATTERNS",
    "BENIGN_EXCLUSION_PHRASES",
    "CONTRAST_PIVOT_RE",
    "CRITICAL_SOLO_WARNING_PHRASES",
    "DIAGNOSIS_REQUEST_PATTERNS",
    "DIAGNOSIS_REQUEST_PHRASES",
    "EMERGENCY_115_HOTLINE",
    "EMERGENCY_RULES",
    "EMERGENCY_SUBTYPE_PRIORITY",
    "EMOTIONAL_DISTRESS_CONTEXT_RE",
    "EXPIRED_MEDICATION_PATTERNS",
    "FALSE_REASSURANCE_PHRASES",
    "FOLK_REPLACEMENT_PATTERNS",
    "FRAGMENTED_STT_DOSAGE_PATTERNS",
    "HISTORICAL_TIME_MARKERS",
    "HISTORICAL_TIME_PATTERNS",
    "HYPOTHETICAL_CONDITIONAL_MARKERS",
    "HYPOTHETICAL_QUESTION_MARKERS",
    "HYPOTHETICAL_STRONG_MARKERS",
    "INABILITY_EMERGENCY_PATTERNS",
    "INABILITY_EMERGENCY_REGEXES",
    "MEDICATION_STATUS_QUERY_PHRASES",
    "MISSED_OR_UNCERTAIN_DOSE_PATTERNS",
    "MODERATE_WARNING_SIGNS",
    "MULTI_SYMPTOM_CRITICAL_PAIRS",
    "NEGATION_MARKERS",
    "NEW_MEDICATION_ADR_PATTERNS",
    "PERIOPERATIVE_ANTICOAGULANT_PATTERNS",
    "POST_LLM_ANTICOAGULANT_DAYS_RE",
    "POST_LLM_ANTIHISTAMINE_RE",
    "POST_LLM_APP_LOG_DEFINITIVE_PROOF_RE",
    "POST_LLM_BANK_CARD_RE",
    "POST_LLM_CCCD_RE",
    "POST_LLM_COMMON_DRUG_NAMES_RE",
    "POST_LLM_CONCRETE_STRENGTH_RE",
    "POST_LLM_DIAGNOSIS_PATTERNS",
    "POST_LLM_DIRECTIVE_MED_VERB_RE",
    "POST_LLM_DOSAGE_PATTERNS",
    "POST_LLM_EMERGENCY_DELAY_PATTERNS",
    "POST_LLM_MEDICAL_CONTEXT_CUE_RE",
    "POST_LLM_PILL_SPECULATION_PATTERNS",
    "POST_LLM_PRIVACY_BULK_OR_INSURER_RE",
    "POST_LLM_PRIVACY_CREDENTIAL_SOLICIT_RE",
    "POST_LLM_PRIVACY_HASH_CONFUSION_RE",
    "POST_LLM_PRIVACY_OTHER_USER_LEAK_RE",
    "POST_LLM_PRIVACY_STORAGE_PROMISE_RE",
    "POST_LLM_REVERSED_KINSHIP_RE",
    "POST_LLM_TAKEN_CLAIM_PATTERNS",
    "POST_LLM_THINK_TAG_RE",
    "POST_LLM_TOXIC_POSITIVITY_RE",
    "POST_LLM_TOXIC_HERBAL_RECIPE_RE",
    "POST_LLM_UNSAFE_FIRST_AID_PATTERNS",
    "POST_LLM_UNSUPPORTED_CAPABILITY_PATTERNS",
    "POST_LLM_VN_PHONE_RE",
    "PRESCRIPTION_DOSAGE_REQUEST_PATTERNS",
    "PRESCRIPTION_DOSAGE_REQUEST_PHRASES",
    "PRESCRIPTION_SHARING_PATTERNS",
    "PREVENTIVE_OR_INFO_MARKERS",
    "PRIVACY_BULK_EXPORT_PATTERNS",
    "PRIVACY_FINANCIAL_SECRET_PATTERNS",
    "PRIVACY_PASSWORD_LOOKUP_PATTERNS",
    "PRIVACY_THIRD_PARTY_ACCESS_PATTERNS",
    "RENAL_LAB_PRESCRIPTION_PATTERNS",
    "SELF_HARM_CRISIS_PATTERNS",
    "SPECIALIST_OVERRIDE_PATTERNS",
    "TABLET_CRUSHING_PATTERNS",
    "TELEPHONY_ACTION_REQUEST_PATTERNS",
    "THYROID_IMAGING_DIAGNOSIS_PATTERNS",
    "TOXIC_POISON_PATTERNS",
    "UNIDENTIFIED_PILL_PATTERNS",
    "UNRECORDED_INTAKE_CLAIM_REQUEST_PATTERNS",
    "EmergencyRule",
    "KnowledgeBoundary",
    "build_capability_honesty_response",
    "build_diagnosis_refusal_response",
    "build_dosage_refusal_response",
    "build_emergency_response",
    "build_emotional_support_safe_fallback",
    "build_false_reassurance_replacement",
    "build_missed_dose_response",
    "build_new_medication_adr_response",
    "build_output_hygiene_safe_fallback",
    "build_privacy_response",
    "build_self_harm_crisis_response",
    "build_tablet_crushing_response",
    "build_toxic_poison_response",
    "build_unidentified_pill_response",
    "build_unrecorded_medication_response",
    "capitalize_honorific",
    "has_clause_local_negation",
    "has_explicit_anti_delay_guard",
    "normalize_safety_text",
    "normalize_vietnamese",
    "resolve_honorific",
    "strip_markdown_and_zero_width",
]
