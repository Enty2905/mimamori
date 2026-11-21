"""Model provider interface with offline mock, OpenAI-compatible, and local Qwen LoRA hooks."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import Settings
from app.core.logging import get_logger
from app.safety.policies import normalize_vietnamese
from app.schemas.companion import EvidenceSource, PersonalContextPayload

logger = get_logger("mimamori.ai_service.provider")


class ProviderConfigurationError(RuntimeError):
    """Raised when a configured external or local model provider cannot run."""


@dataclass(frozen=True)
class ModelGenerationResult:
    """Output returned by a ModelProvider."""

    text: str
    provider: str
    model_name: str
    latency_ms: float
    used_fallback: bool = False


class ModelProvider(ABC):
    """Abstract base interface for Companion AI generation backends."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier returned in API responses and status checks."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Return whether required credentials/paths/dependencies are available."""

    @abstractmethod
    async def generate(
        self,
        *,
        system_prompt: str,
        user_message: str,
        context_block: str,
        evidence_sources: list[EvidenceSource],
        personal_context: Optional[PersonalContextPayload],
    ) -> ModelGenerationResult:
        """Generate a concise, empathetic Vietnamese companion reply."""


class MockModelProvider(ModelProvider):
    """Deterministic offline provider for local development and automated testing."""

    @property
    def provider_name(self) -> str:
        return "mock_companion_provider"

    def is_configured(self) -> bool:
        return True

    @staticmethod
    def _build_medication_status_reply(
        honorific: str,
        personal_context: Optional[PersonalContextPayload],
    ) -> str:
        if not personal_context or not personal_context.medication_logs:
            return (
                f"Trong dữ liệu theo dõi hiện có, cháu chưa thấy ghi nhận {honorific} đã uống liều thuốc nào hôm nay. "
                f"{honorific.capitalize()} hãy kiểm tra khay thuốc, mục Thuốc trên ứng dụng hoặc hỏi người thân trước khi uống nhé."
            )

        taken = [log.medication_name for log in personal_context.medication_logs if log.status == "TAKEN"]
        pending = [
            log.medication_name
            for log in personal_context.medication_logs
            if log.status in {"PENDING", "MISSED"}
        ]
        if taken and pending:
            return (
                f"Theo nhật ký thuốc hiện tại, {honorific} đã ghi nhận uống {', '.join(taken)}; "
                f"còn {', '.join(pending)} vẫn đang chờ xác nhận chứ chưa ghi nhận đã uống ạ."
            )
        if taken:
            return f"Theo nhật ký thuốc hiện tại, {honorific} đã ghi nhận uống {', '.join(taken)} rồi ạ."
        return (
            f"Theo dữ liệu hiện tại, các thuốc ({', '.join(pending)}) chưa có ghi nhận đã uống ạ. "
            f"{honorific.capitalize()} vui lòng kiểm tra hộp thuốc hoặc hỏi người thân để chắc chắn nhé."
        )

    async def generate(
        self,
        *,
        system_prompt: str,
        user_message: str,
        context_block: str,
        evidence_sources: list[EvidenceSource],
        personal_context: Optional[PersonalContextPayload],
    ) -> ModelGenerationResult:
        start = time.perf_counter()
        honorific = (
            personal_context.preferred_honorific
            if personal_context and personal_context.preferred_honorific
            else "ông/bà"
        )
        norm = normalize_vietnamese(user_message)

        if any(
            phrase in norm
            for phrase in ("uong thuoc chua", "da uong thuoc", "sang nay uong chua", "toi nay uong chua")
        ):
            reply = self._build_medication_status_reply(honorific, personal_context)
        elif evidence_sources:
            top = evidence_sources[0]
            excerpt = top.excerpt.strip()
            if len(excerpt) > 260:
                excerpt = excerpt[:257].rstrip() + "..."
            checkin_prefix = ""
            if personal_context and personal_context.daily_checkin and personal_context.daily_checkin.concerning_flag:
                checkin_prefix = (
                    f"Cháu thấy ghi nhận hôm nay {honorific} hơi mệt hoặc chưa được khỏe. "
                )
            reply = (
                f"{checkin_prefix}Dạ {honorific}, theo tài liệu tham khảo '{top.title}': "
                f"{excerpt} Nếu cần hỗ trợ thêm, {honorific} hãy chia sẻ với người thân nhé."
            )
        else:
            checkin_note = ""
            if personal_context and personal_context.daily_checkin and personal_context.daily_checkin.mood:
                checkin_note = f" Cháu luôn lắng nghe {honorific} hôm nay ạ."
            reply = (
                f"Dạ {honorific}, cháu nghe rõ chia sẻ của {honorific} rồi ạ.{checkin_note} "
                f"Hiện cháu chưa tìm thấy tài liệu chuyên biệt khớp hoàn toàn cho câu hỏi này, "
                f"nên chỉ xin trao đổi ở mức gợi ý trò chuyện chung. Nếu cần thông tin y tế chính xác, "
                f"{honorific} nên hỏi thêm người thân hoặc bác sĩ nhé."
            )

        elapsed = (time.perf_counter() - start) * 1000.0
        return ModelGenerationResult(
            text=reply,
            provider=self.provider_name,
            model_name="deterministic-mock-v1",
            latency_ms=round(elapsed, 2),
        )


class OpenAICompatibleProvider(ModelProvider):
    """Async OpenAI-compatible API provider (Groq, vLLM, Ollama, or TGI).

    Loads endpoint and API key strictly from environment Settings; never embeds secrets.
    """

    def __init__(self, settings: Settings) -> None:
        self._api_base = settings.llm_api_base.strip().rstrip("/")
        self._api_key = settings.llm_api_key
        self._model_name = settings.llm_model_name
        self._timeout = settings.llm_timeout_seconds
        self._max_tokens = settings.llm_max_tokens
        self._temperature = settings.llm_temperature

    @property
    def provider_name(self) -> str:
        return "openai_compatible"

    def is_configured(self) -> bool:
        return bool(self._api_base and self._api_key and self._api_key.get_secret_value().strip())

    async def generate(
        self,
        *,
        system_prompt: str,
        user_message: str,
        context_block: str,
        evidence_sources: list[EvidenceSource],
        personal_context: Optional[PersonalContextPayload],
    ) -> ModelGenerationResult:
        if not self.is_configured():
            raise ProviderConfigurationError(
                "OpenAICompatibleProvider requires LLM_API_BASE and LLM_API_KEY in environment settings"
            )

        start = time.perf_counter()
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"{context_block}\n\nCâu hỏi hiện tại của người dùng: {user_message}".strip(),
            },
        ]
        payload: dict[str, object] = {
            "model": self._model_name,
            "messages": messages,
            "max_tokens": self._max_tokens,
            "temperature": self._temperature,
        }
        # Groq's gpt-oss reasoning models consume max_tokens on internal reasoning tokens by default,
        # which can yield empty or truncated message.content at short max_tokens (e.g., 200-320).
        if "api.groq.com" in self._api_base.lower() and "gpt-oss" in self._model_name.lower():
            payload["reasoning_effort"] = "low"
        headers = {
            "Authorization": f"Bearer {self._api_key.get_secret_value()}",  # type: ignore[union-attr]
            "Content-Type": "application/json",
        }

        url = f"{self._api_base}/chat/completions"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices") or []
        if not choices or not isinstance(choices[0], dict):
            raise ProviderConfigurationError("Upstream OpenAI-compatible response contained no choices")

        raw_content = (choices[0].get("message") or {}).get("content")
        text = str(raw_content).strip() if raw_content is not None else ""
        if not text:
            raise ProviderConfigurationError("Upstream OpenAI-compatible response returned empty text")

        elapsed = (time.perf_counter() - start) * 1000.0
        logger.info("External model generation completed in %.1f ms", elapsed)
        return ModelGenerationResult(
            text=text,
            provider=self.provider_name,
            model_name=self._model_name,
            latency_ms=round(elapsed, 2),
        )


class TransformersLocalAdapterProvider(ModelProvider):
    """Local Hugging Face + PEFT LoRA hook for Qwen/Qwen3-4B-Instruct-2507.

    Lazy-loads transformers/peft only on explicit invocation so unit tests and
    CPU-only startup never trigger multi-GB model weight downloads.
    """

    def __init__(self, settings: Settings) -> None:
        self._base_model_id = settings.base_model_id
        self._adapter_path = settings.lora_adapter_path.strip()
        self._max_tokens = settings.llm_max_tokens
        self._temperature = settings.llm_temperature
        self._model = None
        self._tokenizer = None

    @property
    def provider_name(self) -> str:
        return "transformers_local_adapter"

    def is_configured(self) -> bool:
        if not self._adapter_path:
            return False
        adapter_dir = Path(self._adapter_path)
        if not adapter_dir.exists():
            return False
        try:
            import peft  # noqa: F401
            import torch  # noqa: F401
            import transformers  # noqa: F401
        except ImportError:
            return False
        return True

    def _ensure_loaded(self) -> None:
        if self._model is not None and self._tokenizer is not None:
            return
        if not self.is_configured():
            raise ProviderConfigurationError(
                "TransformersLocalAdapterProvider requires a valid LORA_ADAPTER_PATH and transformers/peft/torch installed"
            )
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(self._base_model_id)
        base_model = AutoModelForCausalLM.from_pretrained(
            self._base_model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
        )
        self._model = PeftModel.from_pretrained(base_model, self._adapter_path)
        self._model.eval()
        self._tokenizer = tokenizer

    async def generate(
        self,
        *,
        system_prompt: str,
        user_message: str,
        context_block: str,
        evidence_sources: list[EvidenceSource],
        personal_context: Optional[PersonalContextPayload],
    ) -> ModelGenerationResult:
        start = time.perf_counter()
        self._ensure_loaded()
        import torch

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"{context_block}\n\nCâu hỏi hiện tại: {user_message}".strip(),
            },
        ]
        prompt_text = self._tokenizer.apply_chat_template(  # type: ignore[union-attr]
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = self._tokenizer(prompt_text, return_tensors="pt")  # type: ignore[misc]
        device = next(self._model.parameters()).device  # type: ignore[union-attr]
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = self._model.generate(  # type: ignore[union-attr]
                **inputs,
                max_new_tokens=self._max_tokens,
                do_sample=self._temperature > 0,
                temperature=max(self._temperature, 0.01),
            )
        new_tokens = output_ids[0][inputs["input_ids"].shape[1] :]
        text = self._tokenizer.decode(new_tokens, skip_special_tokens=True).strip()  # type: ignore[union-attr]
        elapsed = (time.perf_counter() - start) * 1000.0
        return ModelGenerationResult(
            text=text,
            provider=self.provider_name,
            model_name=f"{self._base_model_id}+lora",
            latency_ms=round(elapsed, 2),
        )


def build_model_provider(settings: Settings) -> ModelProvider:
    """Instantiate the configured ModelProvider without downloading model weights."""
    if settings.model_provider == "openai_compatible":
        return OpenAICompatibleProvider(settings)
    if settings.model_provider == "transformers_local":
        return TransformersLocalAdapterProvider(settings)
    return MockModelProvider()
