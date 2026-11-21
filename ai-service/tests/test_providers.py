"""Tests for ModelProvider hooks (OpenAICompatibleProvider and TransformersLocalAdapterProvider)."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.models.provider import (
    OpenAICompatibleProvider,
    ProviderConfigurationError,
    TransformersLocalAdapterProvider,
)
from main import create_app


def test_openai_compatible_provider_requires_env_config_and_returns_503_if_missing(tmp_path):
    cfg = Settings(
        _env_file=None,
        environment="test",
        chroma_persist_dir=str(tmp_path / "chroma"),
        model_provider="openai_compatible",
        llm_api_base="",
        llm_api_key=None,
    )
    provider = OpenAICompatibleProvider(cfg)
    assert provider.is_configured() is False

    with pytest.raises(ProviderConfigurationError):
        asyncio.run(
            provider.generate(
                system_prompt="sys",
                user_message="xin chao",
                context_block="",
                evidence_sources=[],
                personal_context=None,
            )
        )

    app = create_app(settings=cfg)
    with TestClient(app) as client:
        resp = client.post("/api/v1/companion/chat", json={"message": "Chào cháu hôm nay trời mát quá"})
        assert resp.status_code == 503
        assert resp.json()["error"] == "provider_unavailable"


def test_openai_compatible_provider_calls_endpoint_with_bearer_header(monkeypatch):
    captured = {}

    class DummyResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {
                "choices": [
                    {"message": {"content": "Cháu chào bác, chúc bác buổi sáng thật vui ạ."}}
                ]
            }

    class DummyAsyncClient:
        def __init__(self, timeout: float) -> None:
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, json: dict, headers: dict):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return DummyResponse()

    monkeypatch.setattr(httpx, "AsyncClient", DummyAsyncClient)

    cfg = Settings(
        _env_file=None,
        model_provider="openai_compatible",
        llm_api_base="https://api.example.test/v1/",
        llm_api_key="test-key-from-env-only",
        llm_model_name="Qwen/Qwen3-4B-Instruct-2507",
    )
    provider = OpenAICompatibleProvider(cfg)
    assert provider.is_configured() is True

    result = asyncio.run(
        provider.generate(
            system_prompt="System prompt",
            user_message="Chào cháu",
            context_block="Ngữ cảnh",
            evidence_sources=[],
            personal_context=None,
        )
    )
    assert result.provider == "openai_compatible"
    assert result.model_name == "Qwen/Qwen3-4B-Instruct-2507"
    assert "Cháu chào bác" in result.text
    assert captured["url"] == "https://api.example.test/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key-from-env-only"


def test_transformers_local_adapter_provider_is_unconfigured_without_adapter_path():
    cfg = Settings(
        _env_file=None,
        model_provider="transformers_local",
        base_model_id="Qwen/Qwen3-4B-Instruct-2507",
        lora_adapter_path="Z:/nonexistent/lora_adapter_dir",
    )
    provider = TransformersLocalAdapterProvider(cfg)
    assert provider.provider_name == "transformers_local_adapter"
    assert provider.is_configured() is False
