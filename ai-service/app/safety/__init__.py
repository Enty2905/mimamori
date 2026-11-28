"""Deterministic medical and emergency safety layer independent of LLMs."""

from app.safety.detector import SafetyAssessment, SafetyDetector
from app.safety.policies import (
    EMERGENCY_115_HOTLINE,
    FALSE_REASSURANCE_PHRASES,
    KnowledgeBoundary,
    normalize_vietnamese,
)

__all__ = [
    "EMERGENCY_115_HOTLINE",
    "FALSE_REASSURANCE_PHRASES",
    "KnowledgeBoundary",
    "SafetyAssessment",
    "SafetyDetector",
    "normalize_vietnamese",
]
