# Container image for the Battleship API.
# Used by the local HA/observability docker-compose stack and suitable for any
# container orchestrator (Kubernetes, ECS, Fly.io, ...).
FROM python:3.12-slim

# uv for fast, reproducible installs.
COPY --from=ghcr.io/astral-sh/uv:0.7.9 /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Install dependencies first for better layer caching.
COPY pyproject.toml uv.lock* README.md ./
RUN uv sync --no-dev --no-install-project

COPY app ./app
RUN uv sync --no-dev

EXPOSE 8000

# Honour the platform-provided $PORT when present (Fly/Cloud Run), else 8000.
CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
