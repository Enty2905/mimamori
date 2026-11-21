"""Entrypoint for Mimamori Companion AI Service (default bind: 127.0.0.1:8001)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI

from app.api.routes import create_router, register_exception_handlers
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging, get_logger
from app.models.provider import ModelProvider, build_model_provider
from app.rag.retriever import ChromaKnowledgeRetriever, build_embedder
from app.safety.detector import SafetyDetector
from app.services.companion_service import CompanionService


def create_app(
    settings: Optional[Settings] = None,
    *,
    model_provider_override: Optional[ModelProvider] = None,
) -> FastAPI:
    """Build and wire the FastAPI Companion AI application."""
    cfg = settings or get_settings()
    configure_logging(cfg.log_level)
    logger = get_logger("mimamori.ai_service")

    def _initialize_service(app_instance: FastAPI) -> None:
        if getattr(app_instance.state, "companion_service", None) is not None:
            return
        embedder = build_embedder(cfg)
        retriever = ChromaKnowledgeRetriever(
            persist_dir=cfg.chroma_persist_dir,
            collection_name=cfg.chroma_collection_name,
            embedder=embedder,
            min_similarity_score=cfg.rag_min_similarity_score,
        )
        indexed = retriever.ensure_indexed_from_dir(cfg.knowledge_dir)
        provider = model_provider_override or build_model_provider(cfg)
        app_instance.state.companion_service = CompanionService(
            settings=cfg,
            safety_detector=SafetyDetector(),
            retriever=retriever,
            model_provider=provider,
        )
        logger.info(
            "Initialized %s v%s | port=%d embedding=%s model_provider=%s indexed_docs=%d",
            cfg.app_name,
            cfg.app_version,
            cfg.port,
            embedder.provider_name,
            provider.provider_name,
            indexed,
        )

    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        _initialize_service(app_instance)
        yield

    application = FastAPI(
        title=cfg.app_name,
        version=cfg.app_version,
        lifespan=lifespan,
    )
    register_exception_handlers(application)
    application.include_router(create_router(cfg))
    return application


app = create_app()


if __name__ == "__main__":
    active_settings = get_settings()
    uvicorn.run(
        "main:app",
        host=active_settings.host,
        port=active_settings.port,
        reload=False,
    )
