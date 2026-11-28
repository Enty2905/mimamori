"""Vietnamese safety text normalization, honorific resolution, and 4-layer clause-local negation."""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from app.schemas.companion import PersonalContextPayload

# Zero-width characters and Markdown formatting markers removed before matching.
_ZERO_WIDTH_RE = re.compile(r"[\u200b\u200c\u200d\ufeff]+")
_INLINE_MARKDOWN_RE = re.compile(r"[*_`~]+")
_BLOCK_MARKDOWN_RE = re.compile(r"[#>]+")

# Five accent-preserving sentinels inserted BEFORE stripping diacritics (NFD)
# so "đừng"/"dừng"/"dùng", "cấm"/"cam", "chớ"/"cho", and "tránh"/"tranh" never collide.
_ACCENT_SENTINELS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(?<!\w)đừng(?!\w)", re.IGNORECASE), "neg_dung_guard"),
    (re.compile(r"(?<!\w)chớ(?!\w)", re.IGNORECASE), "neg_cho_guard"),
    (re.compile(r"(?<!\w)cấm(?!\w)", re.IGNORECASE), "neg_cam_guard"),
    (re.compile(r"(?<!\w)tránh(?!\w)", re.IGNORECASE), "neg_tranh_guard"),
    (re.compile(r"(?<!\w)dừng(?!\w)", re.IGNORECASE), "stop_dung_verb"),
)

_VI_DIACRITIC_DETECT_RE = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩ"
    r"òóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.IGNORECASE,
)

# Layer 2: Clause boundaries, contrast pivots, and unpunctuated affirmative modal pivots.
_CLAUSE_PUNCT_RE = re.compile(r"[.,;!?\n:]")
_HARD_SENTENCE_PUNCT_RE = re.compile(r"[.;!?\n:]")

# Contrast conjunctions that reset negation scope even without punctuation.
# Negative lookaheads prevent splitting on homographs after NFD:
# - "mã PIN / mã OTP / mã số / mã tiền / mã hóa" != "mà"
# - "con gái / con trai / con cháu / con mèo / con số" != "còn"
# - "chỉ định / chỉ số / chi tiết / chỉ dẫn" != "chỉ"
CONTRAST_PIVOT_RE = re.compile(
    r"(?:"
    r"\b(?:nhung|tuy nhien|tuy the|tuy vay|thay vao do|nguoc lai)\b|"
    r"\bma\b(?!\s+(?:pin|otp|so|tien|the|tai khoan|vach|qr|hoa|tran))|"
    r"\bcon\b(?!\s+(?:gai|trai|chau|meo|so|nguoi|dau|re|nho|be|cai|lai|nua|vo|thuoc))|"
    r"(?<!khong )\bchi\b(?!\s+(?:dinh|so|tiet|dan|canh))(?:\s+(?:can|nen))?"
    r")"
)

# Direct negation tokens valid in post-LLM output checks.
# CRITICAL: Unaccented "dung" is NEVER included here so "dùng thuốc" never acts as negation.
_LOCAL_NEGATION_RE = re.compile(
    r"\b(?:"
    r"tuyet doi khong|khong bao gio|khong duoc phep|khong duoc|khong nen|khong the|"
    r"khong tu y|khong co quyen|khong co chuc nang|khong co kha nang|khong dong y|"
    r"khong khuyen|khong cho phep|khong nen tu|khong phai|khong can|khong|"
    r"chua duoc|chua nen|chua the|chua co|chua ro|chua biet|chua xac nhan|khoan|"
    r"neg_dung_guard|neg_cho_guard|neg_cam_guard|neg_tranh_guard|"
    r"can ngan|ngan chan|tu choi|bac bo"
    r")\b"
)

# Negation tokens that directly modify an immediately following modal ("không nên", "chưa nên").
_DIRECT_MODAL_NEGATOR_TAIL_RE = re.compile(
    r"\b(?:tuyet doi\s+)?(?:khong|chua|chang)\s*$"
)

# Completed object indicators after a negated verb (e.g., "đừng uống hai viên ...").
_COMPLETED_OBJECT_RE = re.compile(
    r"(?:\d|\b(?:mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi|nua|ruoi|gap doi|gap ba|"
    r"vien|vi|goi|ong|giot|ml|mg|mcg|gam|lieu|cu|thuoc|don|phut|gio|tieng|ngay|benh|"
    r"mat khau|otp|pin|the|cccd|so)\b)"
)

# Affirmative directive modals or new user subjects that cut an unpunctuated earlier negation.
_UNPUNCTUATED_AFFIRMATIVE_PIVOT_RE = re.compile(
    r"(?<!khong )(?<!chua )(?<!chang )\b(?:nen|cu|co the|phai|hay thu|bac|ong|ba|cu|ban)\b"
)
_UNPUNCTUATED_HAY_PIVOT_RE = re.compile(r"\bhay\s+(?:uong|tang|giam|bo|ngung|dung|thu|nho|boi|giu)\b")
_MATCH_LEADING_AFFIRMATIVE_MODAL_RE = re.compile(r"^(?:nen|cu|co the|phai|hay thu)\b")
_MATCH_LEADING_HAY_RE = re.compile(r"^hay\b")

# Layer 3: Strict coordinated verb-list negation across commas.
_COORD_NEG_PREFIX_RE = re.compile(
    r"\b(?:"
    r"tuyet doi khong|khong bao gio|khong duoc phep|khong tu y|khong duoc|khong nen|khong the|"
    r"khong|neg_dung_guard|neg_cho_guard|neg_cam_guard|neg_tranh_guard"
    r")\b"
)
_COORD_FORBIDDEN_RESET_RE = re.compile(
    r"\b(?:ong|ba|cu|bac|ban|chau|toi|nguoi benh|nen|cu|co the|phai|can|dong y|duoc phep|"
    r"nhung|tuy nhien|tuy the|tuy vay|thay vao do|nguoc lai)\b"
)
_COORD_ALLOWED_VERB_TOKENS = frozenset(
    {
        "tu",
        "y",
        "tang",
        "giam",
        "chinh",
        "dieu",
        "doi",
        "thay",
        "bo",
        "ngung",
        "stop_dung_verb",
        "uong",
        "be",
        "nghien",
        "gia",
        "gop",
        "bu",
        "gap",
        "ke",
        "don",
        "thuoc",
        "lieu",
        "luong",
        "dung",
        "hoac",
        "hay",
        "va",
        "them",
        "bot",
        "nat",
        "nho",
        "vun",
        "nua",
        "chia",
        "cu",
        "tiep",
        "tuc",
        "not",
        "ra",
        "cho",
        "nghi",
        "tam",
        "luu",
        "giu",
        "gui",
        "doc",
        "nhap",
        "cung",
        "cap",
        "xem",
        "mo",
        "tra",
        "cuu",
        "ke",
        "lai",
        "xuat",
        "trich",
        "chan",
        "doan",
        "ket",
        "luan",
        "khang",
        "dinh",
        "boi",
        "dap",
        "xuc",
        "choc",
        "vo",
        "dui",
        "an",
        "vao",
        "mat",
        "goi",
        "dien",
        "nhan",
        "tin",
        "danh",
        "dau",
        "cap",
        "nhat",
    }
)
_COORD_DOSAGE_OBJECT_RE = re.compile(
    r"(?:\d|\b(?:mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|vien|mg|mcg|ml|goi|giot|gam)\b)"
)

# Layer 4: Safe referral before action (e.g. "Hỏi dược sĩ trước khi uống bù").
_SAFE_REFERRAL_BEFORE_ACTION_RE = re.compile(
    r"\b(?:hoi|lien he|trao doi|tham khao|tham van|kiem tra|xac nhan|xin y kien|bao)\b"
    r"(?:\s+(?:lai|them|y kien|cho|voi|ngay|truc tiep))?"
    r"\s+(?:bac si|duoc si|nhan vien y te|co so y te|nguoi than|nguoi nha|gia dinh|"
    r"vi thuoc|hop thuoc|hop chia thuoc|don thuoc|nhan hop)"
    r"[^.,;!?\n]{0,35}\b(?:truoc khi|roi moi|de duoc huong dan(?:\s+ve viec)?)\b"
)
_SAFE_REFERRAL_AFFIRMATIVE_TAIL_RE = re.compile(r"\b(?:nen|cu|co the|phai|hay)\b")

# Strict anti-delay guard (EP-05): ONLY direct prohibition of waiting/delaying counts.
# Conditional failure to improve ("không thuyên giảm sau 5 phút", "không đỡ sau 10 phút")
# MUST NEVER return True here.
_EXPLICIT_ANTI_DELAY_RE = re.compile(
    r"\b(?:"
    r"tuyet doi khong|khong bao gio|khong chap nhan|"
    r"(?:khong|khong duoc|khong nen|neg_dung_guard|neg_cho_guard|neg_cam_guard|neg_tranh_guard)"
    r"\s+(?:tu y\s+)?(?:cho|cho doi|doi|tri hoan|nam cho|nghi cho|tu theo doi|theo doi them|de den sang|ngu)|"
    r"can ngan|bac bo|tu choi"
    r")\b"
)
_DIRECT_WAIT_VERB_NEGATION_RE = re.compile(
    r"(?:\b(?:tuyet doi\s+)?(?:khong|khong duoc|khong nen|khong can|"
    r"neg_dung_guard|neg_cho_guard|neg_cam_guard|neg_tranh_guard)"
    r"(?:\s+(?:tu y|co|nam|ngoi|nen|duoc|tiep tuc|phai))?\s*$|"
    r"\b(?:khong|neg_dung_guard|khong nen|khong duoc|tuyet doi khong)\s+"
    r"(?:cho|cho doi|doi|nam cho|nghi cho|theo doi|ngu|tri hoan)[^.,;!?\n]{0,35}\b(?:hay|hoac|va)\s*$)"
)


def strip_markdown_and_zero_width(text: str) -> str:
    """Remove zero-width chars and Markdown syntax markers cleanly."""
    if not text:
        return ""
    cleaned = _ZERO_WIDTH_RE.sub("", text)
    cleaned = _INLINE_MARKDOWN_RE.sub("", cleaned)
    cleaned = _BLOCK_MARKDOWN_RE.sub(" ", cleaned)
    return cleaned


def normalize_safety_text(
    text: str,
    *,
    preserve_punctuation: bool = True,
    with_accent_sentinels: bool = True,
) -> str:
    """Normalize text for safety detection: NFC -> strip zero-width/Markdown -> 5 sentinels -> NFD strip."""
    if not text:
        return ""
    cleaned = strip_markdown_and_zero_width(unicodedata.normalize("NFC", text)).lower()
    if with_accent_sentinels:
        for pattern, sentinel in _ACCENT_SENTINELS:
            cleaned = pattern.sub(sentinel, cleaned)
    folded = cleaned.replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", folded)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    if preserve_punctuation:
        without_marks = re.sub(r"[ \t\r\f\v]+", " ", without_marks)
        without_marks = re.sub(r"\n+", "\n", without_marks)
        return without_marks.strip()
    return re.sub(r"\s+", " ", without_marks).strip()


def _extract_local_clause_prefix(norm_text: str, match_start: int, max_chars: int = 80) -> str:
    """Extract same-clause prefix before match_start, stopping at punctuation, contrastors, and unpunctuated pivots."""
    window_start = max(0, match_start - max_chars)
    prefix = norm_text[window_start:match_start]

    punct_matches = list(_CLAUSE_PUNCT_RE.finditer(prefix))
    if punct_matches:
        prefix = prefix[punct_matches[-1].end() :]

    conj_matches = list(CONTRAST_PIVOT_RE.finditer(prefix))
    if conj_matches:
        prefix = prefix[conj_matches[-1].end() :]

    # Layer 2.3: Cut unpunctuated affirmative modal/subject pivot after a completed negated object
    # e.g., "neg_dung_guard uong hai vien nen [uong mot vien]" -> cut at "nen".
    neg_matches = list(_LOCAL_NEGATION_RE.finditer(prefix))
    if neg_matches:
        after_first_neg_idx = neg_matches[0].end()
        tail = prefix[after_first_neg_idx:]
        if _COMPLETED_OBJECT_RE.search(tail):
            pivot_cut: Optional[int] = None
            for m in _UNPUNCTUATED_AFFIRMATIVE_PIVOT_RE.finditer(tail):
                before_m = tail[: m.start()]
                if _COMPLETED_OBJECT_RE.search(before_m):
                    pivot_cut = after_first_neg_idx + m.end()
            for m in _UNPUNCTUATED_HAY_PIVOT_RE.finditer(tail):
                before_m = tail[: m.start()]
                if _COMPLETED_OBJECT_RE.search(before_m):
                    cand = after_first_neg_idx + m.start()
                    if pivot_cut is None or cand > pivot_cut:
                        pivot_cut = cand
            if pivot_cut is not None:
                prefix = prefix[pivot_cut:]

    return prefix.strip()


def _has_coordinated_comma_list_negation(
    norm_text: str,
    match_start: int,
    *,
    max_chars: int = 80,
) -> bool:
    """Layer 3: Allow negation to propagate across commas ONLY for parallel medication verb chains."""
    window_start = max(0, match_start - max_chars)
    prefix = norm_text[window_start:match_start]

    hard_matches = list(_HARD_SENTENCE_PUNCT_RE.finditer(prefix))
    if hard_matches:
        prefix = prefix[hard_matches[-1].end() :]

    conj_matches = list(CONTRAST_PIVOT_RE.finditer(prefix))
    if conj_matches:
        prefix = prefix[conj_matches[-1].end() :]

    if "," not in prefix:
        return False

    neg_matches = list(_COORD_NEG_PREFIX_RE.finditer(prefix))
    if not neg_matches:
        return False

    after_neg = prefix[neg_matches[-1].end() :].strip()
    if "," not in after_neg or len(after_neg) > max_chars:
        return False

    # Reject if match itself starts with an affirmative directive modal
    tail_at_match = norm_text[match_start : match_start + 16].lstrip()
    if _MATCH_LEADING_AFFIRMATIVE_MODAL_RE.match(tail_at_match):
        return False

    # Guard 3: No new subject, contrast pivot, or affirmative directive modal between negation and match
    if _COORD_FORBIDDEN_RESET_RE.search(after_neg):
        return False

    # Reject if pre-comma already contains a numeric/spelled dosage object (e.g. "không uống 2 viên, ...")
    pre_comma = after_neg.rsplit(",", 1)[0].strip()
    if _COORD_DOSAGE_OBJECT_RE.search(pre_comma):
        return False

    # Guard 2: All tokens across the comma/conjunction segments must be allowed parallel action verbs
    segments = [seg.strip() for seg in re.split(r"[,]+|\b(?:hoac|hay|va)\b", after_neg) if seg.strip()]
    if not segments:
        return False
    for seg in segments:
        words = seg.split()
        if not words or len(words) > 4:
            return False
        if not all(w in _COORD_ALLOWED_VERB_TOKENS for w in words):
            return False

    return True


def has_clause_local_negation(
    norm_text: str,
    match_start: int,
    *,
    max_chars: int = 80,
) -> bool:
    """4-layer clause-level negation & safe-referral check for post-LLM safety validation."""
    local_prefix = _extract_local_clause_prefix(norm_text, match_start, max_chars=max_chars)
    tail_at_match = norm_text[match_start : match_start + 20].lstrip()

    # Check if match_start itself opens an unpunctuated affirmative modal clause after a completed negated object
    # e.g. "neg_dung_guard uong hai vien [nen uong mot vien]" -> match starts at "nen"!
    if local_prefix:
        starts_with_modal = bool(_MATCH_LEADING_AFFIRMATIVE_MODAL_RE.match(tail_at_match))
        starts_with_hay = bool(_MATCH_LEADING_HAY_RE.match(tail_at_match))
        if (starts_with_modal or starts_with_hay) and not _DIRECT_MODAL_NEGATOR_TAIL_RE.search(local_prefix):
            neg_matches = list(_LOCAL_NEGATION_RE.finditer(local_prefix))
            if neg_matches:
                between_neg_and_match = local_prefix[neg_matches[-1].end() :].strip()
                if starts_with_modal and between_neg_and_match:
                    # e.g. "neg_dung_guard uong hai vien" + "nen uong mot vien" -> NOT negated!
                    return False
                if starts_with_hay and _COMPLETED_OBJECT_RE.search(between_neg_and_match):
                    return False

        # Layer 1 & 2: Direct local negation in same clause
        if _LOCAL_NEGATION_RE.search(local_prefix):
            return True

        # Layer 4: Safe referral before action ("hỏi dược sĩ trước khi uống bù")
        ref_match = _SAFE_REFERRAL_BEFORE_ACTION_RE.search(local_prefix)
        if ref_match:
            after_ref = local_prefix[ref_match.end() :]
            if not _SAFE_REFERRAL_AFFIRMATIVE_TAIL_RE.search(after_ref) and not starts_with_modal:
                return True

    # Layer 3: Coordinated comma-separated verb list sharing a single negation
    return _has_coordinated_comma_list_negation(norm_text, match_start, max_chars=max_chars)


def has_explicit_anti_delay_guard(
    norm_text: str,
    match_start: int,
    *,
    max_chars: int = 80,
    pattern_code: str = "",
) -> bool:
    """EP-05: Return True ONLY when waiting/delaying itself is explicitly prohibited.

    Never treats conditional symptom non-improvement ("không thuyên giảm sau 5 phút",
    "không đỡ sau 10 phút") as an anti-delay guard.
    """
    local_prefix = _extract_local_clause_prefix(norm_text, match_start, max_chars=max_chars)
    if not local_prefix:
        return False
    if _EXPLICIT_ANTI_DELAY_RE.search(local_prefix):
        return True
    if pattern_code != "watchful_waiting_after_minutes":
        return bool(_DIRECT_WAIT_VERB_NEGATION_RE.search(local_prefix))
    return False


# ---------------------------------------------------------------------------
# Honorific Inference (preferred_honorific -> message self-reference -> "ông/bà")
# ---------------------------------------------------------------------------

_ACCENTED_SELF_HONORIFIC_RE = re.compile(
    r"(?:^|[\s,.;!?\n])(?:(?:cho|giúp|giùm|của|với|xem)\s+)?"
    r"(cụ|bác|ông|bà)\s+"
    r"(?:đang|bị|vừa|mới|thấy|muốn|định|uống|quên|nhớ|sợ|lo|mất|tìm|để|chuẩn bị|"
    r"có|không|chẳng|ngồi|đi|nằm|hỏi|đo|nghe|lau|tự|sẽ|phải|hay|cứ|lại|bỏ|nghỉ|lấy|gộp|tăng|giảm|bôi|xem|trả|cần|biết|thấy|lơ đễnh)",
    re.IGNORECASE,
)
_ACCENTED_OBJECT_HONORIFIC_RE = re.compile(
    r"\b(?:cho|giúp|giùm|với)\s+(cụ|bác|ông|bà)\b(?!\s+(?:ấy|nhà|bên|tầng|hàng xóm|[A-ZÀ-Ỹ]))",
    re.IGNORECASE,
)
_ACCENTED_ANY_HONORIFIC_RE = re.compile(
    r"(?<![\w])(cụ|bác|ông|bà)(?!\s+(?:sĩ|si|ấy|ay|nhà|nha|bên|ben|tầng|tang|tam|tư|tu|[A-ZÀ-Ỹ]))(?![\w])"
)
_UNACCENTED_SELF_HONORIFIC_RE = re.compile(
    r"(?:^|[\s,.;!?\n])(cu|bac|ong|ba)\s+"
    r"(?:dang|bi|vua|moi|thay|muon|dinh|uong|quen|nho|so|lo|mat|tim|de|co|khong|chang|ngoi|di|nam|hoi|tu|se|phai|hay|cu|lai|bo|nghi|lay|gop|tang|giam)\b"
)
_UNACCENTED_OBJECT_HONORIFIC_RE = re.compile(
    r"\b(?:cho|giup|gium|voi)\s+(cu|bac|ong|ba)\b(?!\s+(?:si|ay|nha|tam|tu|thuoc))"
)
_UNACCENTED_TO_ACCENTED = {
    "cu": "cụ",
    "bac": "bác",
    "ong": "ông",
    "ba": "bà",
}


def resolve_honorific(
    message: str,
    personal_context: Optional[PersonalContextPayload] = None,
    fallback: str = "ông/bà",
) -> str:
    """Resolve Vietnamese honorific: preferred_honorific -> speaker self-reference -> fallback."""
    if personal_context and personal_context.preferred_honorific:
        return personal_context.preferred_honorific

    if not message:
        return fallback

    nfc = unicodedata.normalize("NFC", message)
    has_diacritics = bool(_VI_DIACRITIC_DETECT_RE.search(nfc))

    if has_diacritics:
        # 1) Speaker self-reference as grammatical subject
        m_subj = _ACCENTED_SELF_HONORIFIC_RE.search(nfc)
        if m_subj:
            return m_subj.group(1).lower()
        # 2) Speaker as beneficiary ("cho bà", "giúp cụ")
        m_obj = _ACCENTED_OBJECT_HONORIFIC_RE.search(nfc)
        if m_obj:
            return m_obj.group(1).lower()
        # 3) Fallback standalone honorific (excluding "bác sĩ", "ông ấy", proper names like "cụ Trần Thị Mai")
        m_any = _ACCENTED_ANY_HONORIFIC_RE.search(nfc)
        if m_any:
            return m_any.group(1).lower()
    else:
        low = nfc.lower()
        m_subj = _UNACCENTED_SELF_HONORIFIC_RE.search(low)
        if m_subj:
            return _UNACCENTED_TO_ACCENTED[m_subj.group(1)]
        m_obj = _UNACCENTED_OBJECT_HONORIFIC_RE.search(low)
        if m_obj:
            return _UNACCENTED_TO_ACCENTED[m_obj.group(1)]

    return fallback


def capitalize_honorific(honorific: str) -> str:
    """Capitalize Vietnamese honorific cleanly (e.g. 'ông/bà' -> 'Ông/bà', 'cụ' -> 'Cụ')."""
    if not honorific:
        return "Ông/bà"
    return honorific[0].upper() + honorific[1:]
