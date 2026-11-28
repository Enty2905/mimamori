import hmac
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from src.common.errors import IngestionError
from src.common.http_limits import RequestSizeLimit
from src.common.settings import Settings
from src.ingestion.service import IngestionResult, IngestionService
from src.retrieval.contracts import RetrievalRequest, RetrievalResponse
from src.retrieval.service import RetrievalService


class ApiError(BaseModel):
    code: str
    message: str
    timestamp: datetime


def error_response(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "code": code,
            "message": message,
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )


def create_app(
    settings: Settings | None = None,
    service: IngestionService | None = None,
) -> FastAPI:
    configuration = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        yield
        instance = application.state.ingestion
        if instance:
            instance.store.close()

    application = FastAPI(
        title="Mimamori AI Service",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        responses={status: {"model": ApiError} for status in (401, 413, 422, 500, 503)},
        lifespan=lifespan,
    )
    application.state.ingestion = service

    def authorized(
        x_internal_token: Annotated[
            str | None, Depends(APIKeyHeader(name="X-Internal-Token", auto_error=False))
        ] = None,
    ) -> None:
        configured = configuration.internal_token
        expected = configured.get_secret_value() if configured else ""
        if len(expected) < 32:
            raise IngestionError("INTERNAL_AUTH_UNCONFIGURED", "Internal API is disabled.", 503)
        if not x_internal_token or not hmac.compare_digest(
            x_internal_token.encode(), expected.encode()
        ):
            raise IngestionError("UNAUTHORIZED", "Internal authentication is required.", 401)

    # Construction is cheap and model loading remains lazy under the ingestion lock.
    # Instantiate once at app construction; Qdrant's compatibility check is disabled
    # in VectorStore so no network call is required by liveness.
    def engine() -> IngestionService:
        return application.state.ingestion

    if service is None:
        application.state.ingestion = IngestionService(configuration)

    @application.exception_handler(IngestionError)
    async def ingestion_error(_request: Request, error: IngestionError):
        return error_response(error.code, error.message, error.status)

    @application.exception_handler(RequestValidationError)
    async def invalid_request(_request: Request, _error: RequestValidationError):
        # FastAPI's default detail may echo input, including sensitive text.
        return error_response("INVALID_REQUEST", "Request is invalid.", 422)

    @application.middleware("http")
    async def safe_failures(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            # Never return/log source bytes, request headers or upstream error details.
            return error_response("INTERNAL_ERROR", "Operation could not be completed.", 500)

    @application.get("/health/live")
    def live():
        return {"status": "ok"}

    @application.get("/health/ready", dependencies=[Depends(authorized)])
    def ready():
        engine().store.ready()
        return {"status": "ready"}

    @application.post(
        "/internal/v1/ingestions/{source_key}",
        response_model=IngestionResult,
        dependencies=[Depends(authorized)],
    )
    def ingest(source_key: Annotated[str, Path(pattern=r"^[a-z][a-z0-9_-]{0,79}$")]):
        return engine().ingest(source_key)

    @application.delete(
        "/internal/v1/ingestions/{source_key}",
        dependencies=[Depends(authorized)],
    )
    def purge(source_key: Annotated[str, Path(pattern=r"^[a-z][a-z0-9_-]{0,79}$")]):
        return {"document_id": engine().purge(source_key), "status": "purged"}

    @application.post(
        "/internal/v1/retrievals",
        response_model=RetrievalResponse,
        dependencies=[Depends(authorized)],
    )
    def retrieve(request: RetrievalRequest):
        return RetrievalService(engine()).retrieve(request)

    application.add_middleware(RequestSizeLimit)
    return application


app = create_app()
