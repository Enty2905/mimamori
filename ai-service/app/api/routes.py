"""FastAPI HTTP endpoints and structured error handlers."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import Settings
from app.core.logging import get_logger, scrub_sensitive_text
from app.models.provider import ProviderConfigurationError
from app.schemas.companion import (
    CompanionChatRequest,
    CompanionChatResponse,
    CompanionStatusResponse,
    ErrorResponse,
    HealthResponse,
)
from app.services.companion_service import CompanionService

logger = get_logger("mimamori.ai_service.api")


def create_router(settings: Settings) -> APIRouter:
    """Create FastAPI router for health, status, and companion chat endpoints."""
    router = APIRouter()

    def _get_service(request: Request) -> CompanionService:
        service = getattr(request.app.state, "companion_service", None)
        if service is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="CompanionService is not initialized",
            )
        return service

    @router.get("/health", response_model=HealthResponse, tags=["System"])
    async def health_check() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=settings.app_name,
            version=settings.app_version,
            port=settings.port,
        )

    @router.get(
        "/api/v1/companion/status",
        response_model=CompanionStatusResponse,
        tags=["Companion AI"],
    )
    async def companion_status(request: Request) -> CompanionStatusResponse:
        service = _get_service(request)
        return service.get_status()

    @router.post(
        "/api/v1/companion/chat",
        response_model=CompanionChatResponse,
        tags=["Companion AI"],
    )
    async def companion_chat(
        payload: CompanionChatRequest,
        request: Request,
    ) -> CompanionChatResponse:
        service = _get_service(request)
        return await service.handle_chat(payload)

    return router


def register_exception_handlers(app: FastAPI) -> None:
    """Register privacy-safe structured JSON error handlers."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = []
        for err in exc.errors():
            loc = ".".join(str(part) for part in err.get("loc", []))
            msg = scrub_sensitive_text(str(err.get("msg", "Invalid input")))
            details.append({"field": loc, "message": msg})
        logger.warning("Request validation error on path=%s error_count=%d", request.url.path, len(details))
        body = ErrorResponse(
            error="validation_error",
            message="Dữ liệu đầu vào không hợp lệ hoặc vi phạm giới hạn ngữ cảnh tối giản.",
            details=details,
        )
        return JSONResponse(status_code=422, content=body.model_dump())

    @app.exception_handler(ProviderConfigurationError)
    async def provider_config_handler(
        request: Request, exc: ProviderConfigurationError
    ) -> JSONResponse:
        logger.error("Model provider configuration error on path=%s: %s", request.url.path, str(exc))
        body = ErrorResponse(
            error="provider_unavailable",
            message="Nhà cung cấp mô hình AI chưa được cấu hình đầy đủ.",
        )
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=body.model_dump())

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        safe_detail = scrub_sensitive_text(str(exc.detail))
        body = ErrorResponse(error="http_error", message=safe_detail)
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled internal error on path=%s type=%s", request.url.path, type(exc).__name__)
        body = ErrorResponse(
            error="internal_server_error",
            message="Đã xảy ra lỗi nội bộ khi xử lý yêu cầu.",
        )
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body.model_dump())
