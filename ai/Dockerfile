FROM ghcr.io/astral-sh/uv:0.12.3 AS uv
FROM python:3.13-slim
WORKDIR /app
COPY --from=uv /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src/ src/
COPY datasets/approved/ datasets/approved/
RUN useradd --system --uid 10002 --create-home mimamori-ai \
    && mkdir -p /app/models /app/artifacts \
    && chown -R mimamori-ai:mimamori-ai /app/models /app/artifacts
ENV PATH="/app/.venv/bin:$PATH" \
    HF_HUB_DISABLE_TELEMETRY=1 \
    HF_HUB_DISABLE_PROGRESS_BARS=1
USER mimamori-ai
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=3)"
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
