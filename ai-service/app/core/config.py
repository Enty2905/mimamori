"""Application settings loaded strictly from environment variables or .env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_DIR = AI_SERVICE_ROOT / "app" / "rag" / "knowledge"


class Settings(BaseSettings):
    """Runtime configuration for Mimamori Companion AI Service.

    All secrets (API keys, service tokens) must be supplied via environment
    variables or an ignored local .env file; never define secret defaults here.
    """

    model_config = SettingsConfigDict(
        env_file=str(AI_SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Mimamori Companion AI Service"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "staging", "production"] = "development"
    host: str = Field(default="127.0.0.1", description="Local bind host (never collide with port 8000)")
    port: int = Field(default=8001, ge=1024, le=65535)
    log_level: str = "INFO"

    # Embedding & ChromaDB settings
    embedding_provider: Literal["hash_dev", "huggingface_e5"] = "hash_dev"
    embedding_model_name: str = "intfloat/multilingual-e5-base"
    embedding_dimension: int = Field(default=768, ge=64, le=2048)
    chroma_persist_dir: str = Field(default=r"E:\mimamori_artifacts\chroma")
    chroma_collection_name: str = "mimamori_companion_knowledge"
    knowledge_dir: str = Field(default=str(DEFAULT_KNOWLEDGE_DIR))
    rag_top_k: int = Field(default=3, ge=1, le=10)
    rag_min_similarity_score: float = Field(default=0.25, ge=0.0, le=1.0)

    # LLM Provider settings (no hardcoded secrets)
    model_provider: Literal["mock", "openai_compatible", "transformers_local"] = "mock"
    llm_api_base: str = ""
    llm_api_key: SecretStr | None = None
    llm_model_name: str = "openai/gpt-oss-120b"
    llm_timeout_seconds: float = Field(default=20.0, ge=1.0, le=120.0)
    llm_max_tokens: int = Field(default=320, ge=32, le=2048)
    llm_temperature: float = Field(default=0.3, ge=0.0, le=1.5)

    # Local Transformers / LoRA adapter hook (Qwen/Qwen3-4B-Instruct-2507)
    base_model_id: str = "Qwen/Qwen3-4B-Instruct-2507"
    lora_adapter_path: str = ""

    # Optional internal service header check (disabled when unset)
    service_auth_token: SecretStr | None = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached runtime settings instance."""
    return Settings()
