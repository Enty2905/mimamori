"""Companion AI orchestration: Pre-safety -> RAG -> Context -> LLM -> Post-safety."""

from __future__ import annotations

import time
from typing import Optional

from app.core.config import Settings
from app.core.logging import get_logger
from app.models.provider import ModelProvider, ProviderConfigurationError
from app.rag.retriever import ChromaKnowledgeRetriever
from app.safety.detector import SafetyDetector
from app.safety.policies import KnowledgeBoundary
from app.schemas.companion import (
    CompanionChatRequest,
    CompanionChatResponse,
    CompanionStatusResponse,
    EvidenceSource,
    PersonalContextPayload,
)
from app.rag.knowledge_loader import ALLOWED_CATEGORIES

logger = get_logger("mimamori.ai_service.service")

_BASE_SYSTEM_PROMPT = (
    "Bạn là Mimamori AI, người bạn đồng hành ấm áp, tôn trọng và kiên nhẫn dành cho người cao tuổi Việt Nam. "
    "Xưng hô lễ phép (cháu - ông/bà hoặc bác). Trả lời ngắn gọn 2 đến 4 câu, rõ ràng để đọc thành tiếng. "
    "Tuyệt đối KHÔNG chẩn đoán bệnh, KHÔNG kê đơn hoặc thay đổi liều thuốc, "
    "KHÔNG khẳng định người dùng đã uống thuốc nếu nhật ký không ghi nhận status TAKEN, "
    "và nếu không có tài liệu tham khảo khớp thì phải nêu rõ giới hạn hiểu biết."
)


class CompanionService:
    """Orchestrates deterministic safety gates, RAG retrieval, and model generation."""

    def __init__(
        self,
        *,
        settings: Settings,
        safety_detector: SafetyDetector,
        retriever: ChromaKnowledgeRetriever,
        model_provider: ModelProvider,
    ) -> None:
        self._settings = settings
        self._safety = safety_detector
        self._retriever = retriever
        self._provider = model_provider

    @staticmethod
    def _format_personal_context(personal_context: Optional[PersonalContextPayload]) -> str:
        """Format minimal non-PII Spring Boot context for model prompt (never logged)."""
        if personal_context is None:
            return "Không có ngữ cảnh cá nhân bổ sung."

        parts: list[str] = []
        if personal_context.preferred_honorific:
            parts.append(f"Cách xưng hô ưu tiên: {personal_context.preferred_honorific}")

        if personal_context.daily_checkin:
            dc = personal_context.daily_checkin
            parts.append(
                f"Điểm danh hôm nay ({dc.checkin_date or 'gần nhất'}): "
                f"tâm trạng={dc.mood or 'không rõ'}, thể trạng={dc.physical_health or 'không rõ'}, "
                f"giấc ngủ={dc.sleep_quality or 'không rõ'}, ăn uống={dc.appetite or 'không rõ'}, "
                f"cờ chú ý={dc.concerning_flag}"
            )

        if personal_context.medication_schedules:
            sched_lines = [
                f"- {s.medication_name} ({s.dosage_amount or 'theo đơn'}, giờ nhắc: {s.reminder_time or 'N/A'})"
                for s in personal_context.medication_schedules
            ]
            parts.append("Lịch thuốc:\n" + "\n".join(sched_lines))

        if personal_context.medication_logs:
            log_lines = [
                f"- {log.medication_name}: trạng thái={log.status} (giờ lịch={log.scheduled_time or 'N/A'})"
                for log in personal_context.medication_logs
            ]
            parts.append("Nhật ký uống thuốc (CHỈ coi là đã uống nếu status=TAKEN):\n" + "\n".join(log_lines))
        else:
            parts.append("Nhật ký uống thuốc: CHƯA CÓ ghi nhận TAKEN nào.")

        if personal_context.health_notes:
            note_lines: list[str] = []
            for note in personal_context.health_notes:
                if isinstance(note, str):
                    note_lines.append(f"- {note}")
                else:
                    note_lines.append(
                        f"- {note.condition_name or 'Ghi chú'} ({note.status or 'N/A'}): {note.summary}"
                    )
            parts.append("Ghi chú sức khỏe tóm tắt:\n" + "\n".join(note_lines))

        if personal_context.recent_messages:
            turns = [f"{m.role}: {m.content}" for m in personal_context.recent_messages[-6:]]
            parts.append("Hội thoại gần đây:\n" + "\n".join(turns))

        return "\n\n".join(parts) if parts else "Không có ngữ cảnh cá nhân bổ sung."

    @staticmethod
    def _format_evidence_block(evidence_sources: list[EvidenceSource]) -> str:
        if not evidence_sources:
            return "Tài liệu tham khảo RAG: Không có tài liệu nào đạt ngưỡng tin cậy."
        lines = [
            f"[{idx}] ({ev.category} | {ev.review_status} | {ev.source}) {ev.title}: {ev.excerpt}"
            for idx, ev in enumerate(evidence_sources, start=1)
        ]
        return "Tài liệu tham khảo RAG:\n" + "\n".join(lines)

    def get_status(self) -> CompanionStatusResponse:
        indexed_count = self._retriever.count()
        return CompanionStatusResponse(
            status="ready" if indexed_count > 0 else "degraded",
            service=self._settings.app_name,
            version=self._settings.app_version,
            embedding_provider=self._retriever.embedder.provider_name,
            embedding_model_name=self._retriever.embedder.model_name,
            model_provider=self._provider.provider_name,
            model_provider_configured=self._provider.is_configured(),
            chroma_persist_dir=self._settings.chroma_persist_dir,
            collection_name=self._settings.chroma_collection_name,
            indexed_documents=indexed_count,
            categories=list(ALLOWED_CATEGORIES),
            safety_layer_active=True,
        )

    async def handle_chat(self, request: CompanionChatRequest) -> CompanionChatResponse:
        start = time.perf_counter()
        used_personal_context = request.personal_context is not None

        # 1) Pre-LLM deterministic safety & medical guardrail gate
        pre_assessment = self._safety.evaluate_input(request.message, request.personal_context)
        if pre_assessment.bypass_llm and pre_assessment.deterministic_reply:
            emergency_evidence: list[EvidenceSource] = []
            if pre_assessment.knowledge_boundary == KnowledgeBoundary.EMERGENCY_PROTOCOL.value:
                rag_emergency = self._retriever.retrieve(
                    "đường dây nóng cấp cứu 115",
                    category="emergency_guidance",
                    top_k=1,
                    min_score=0.05,
                )
                emergency_evidence = [
                    ev
                    for ev in rag_emergency.evidence_sources
                    if ev.review_status == "reviewed_official_hotline"
                ]

            elapsed_ms = (time.perf_counter() - start) * 1000.0
            logger.info(
                "Companion chat handled by safety gate | safety_triggered=%s risk_level=%s boundary=%s latency_ms=%.1f",
                True,
                pre_assessment.risk_level,
                pre_assessment.knowledge_boundary,
                elapsed_ms,
            )
            return CompanionChatResponse(
                reply=pre_assessment.deterministic_reply,
                safety_triggered=True,
                risk_level=pre_assessment.risk_level,
                escalation_guidance=pre_assessment.escalation_guidance,
                evidence_sources=emergency_evidence,
                uncertainty_note=None,
                knowledge_boundary=pre_assessment.knowledge_boundary
                or KnowledgeBoundary.EMERGENCY_PROTOCOL.value,
                provider="deterministic_safety_gate",
                guardrail_flags=pre_assessment.guardrail_flags,
                used_personal_context=used_personal_context,
            )

        # 2) RAG Retrieval (with optional strict category isolation)
        retrieval = self._retriever.retrieve(
            request.message,
            category=request.category_hint,
            top_k=request.top_k,
        )

        # 3) Handle missing-evidence policy when caller forbids general-knowledge fallback
        if not retrieval.has_sufficient_evidence and not request.include_general_knowledge:
            honorific = (
                request.personal_context.preferred_honorific
                if request.personal_context and request.personal_context.preferred_honorific
                else "ông/bà"
            )
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            logger.info(
                "Companion chat returned insufficient_evidence | safety_triggered=%s risk_level=%s latency_ms=%.1f",
                False,
                pre_assessment.risk_level,
                elapsed_ms,
            )
            return CompanionChatResponse(
                reply=(
                    f"Dạ {honorific}, cháu chưa tìm thấy tài liệu xác thực phù hợp trong kho tri thức "
                    f"để trả lời chắc chắn cho câu hỏi này. {honorific.capitalize()} vui lòng hỏi thêm người thân "
                    f"hoặc bác sĩ để có thông tin chính xác nhé."
                ),
                safety_triggered=False,
                risk_level=pre_assessment.risk_level,
                escalation_guidance=None,
                evidence_sources=[],
                uncertainty_note=retrieval.uncertainty_note,
                knowledge_boundary=KnowledgeBoundary.INSUFFICIENT_EVIDENCE.value,
                provider="rag_uncertainty_gate",
                guardrail_flags=[*pre_assessment.guardrail_flags, "missing_evidence_uncertainty"],
                used_personal_context=used_personal_context,
            )

        # 4) Context formatting & ModelProvider generation
        context_block = (
            f"{self._format_personal_context(request.personal_context)}\n\n"
            f"{self._format_evidence_block(retrieval.evidence_sources)}"
        )

        if not self._provider.is_configured():
            raise ProviderConfigurationError(
                f"Configured model provider '{self._provider.provider_name}' is missing required settings."
            )

        generation = await self._provider.generate(
            system_prompt=_BASE_SYSTEM_PROMPT,
            user_message=request.message,
            context_block=context_block,
            evidence_sources=retrieval.evidence_sources,
            personal_context=request.personal_context,
        )

        # 5) Post-LLM deterministic safety validation
        post_assessment = self._safety.validate_output(
            generation.text,
            pre_assessment,
            request.personal_context,
        )
        if post_assessment.safety_triggered and post_assessment.deterministic_reply:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            logger.info(
                "Companion chat overridden by post-LLM guardrail | risk_level=%s flags=%s latency_ms=%.1f",
                post_assessment.risk_level,
                ",".join(post_assessment.guardrail_flags),
                elapsed_ms,
            )
            return CompanionChatResponse(
                reply=post_assessment.deterministic_reply,
                safety_triggered=True,
                risk_level=post_assessment.risk_level,
                escalation_guidance=post_assessment.escalation_guidance,
                evidence_sources=retrieval.evidence_sources,
                uncertainty_note=retrieval.uncertainty_note,
                knowledge_boundary=post_assessment.knowledge_boundary
                or KnowledgeBoundary.MEDICAL_GUARDRAIL_REFUSAL.value,
                provider=generation.provider,
                guardrail_flags=post_assessment.guardrail_flags,
                used_personal_context=used_personal_context,
            )

        boundary = (
            KnowledgeBoundary.RETRIEVED_EVIDENCE.value
            if retrieval.has_sufficient_evidence
            else KnowledgeBoundary.GENERAL_GUIDANCE_ONLY.value
        )
        flags = list(pre_assessment.guardrail_flags)
        if not retrieval.has_sufficient_evidence:
            flags.append("missing_evidence_uncertainty")

        escalation = (
            "Theo dõi sức khỏe và báo cho người thân hoặc bác sĩ nếu triệu chứng kéo dài hoặc nặng hơn."
            if pre_assessment.risk_level == "moderate"
            else None
        )

        elapsed_ms = (time.perf_counter() - start) * 1000.0
        logger.info(
            "Companion chat succeeded | safety_triggered=%s risk_level=%s boundary=%s evidence_count=%d provider=%s latency_ms=%.1f",
            False,
            pre_assessment.risk_level,
            boundary,
            len(retrieval.evidence_sources),
            generation.provider,
            elapsed_ms,
        )
        return CompanionChatResponse(
            reply=generation.text,
            safety_triggered=False,
            risk_level=pre_assessment.risk_level,
            escalation_guidance=escalation,
            evidence_sources=retrieval.evidence_sources,
            uncertainty_note=retrieval.uncertainty_note,
            knowledge_boundary=boundary,
            provider=generation.provider,
            guardrail_flags=flags,
            used_personal_context=used_personal_context,
        )
