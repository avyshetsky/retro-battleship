# Battleship API

FastAPI backend for Retro Battleship. It serves the AI opponent's moves, the
contextual taunts, and a high-score leaderboard — all instrumented with
OpenTelemetry (traces + metrics over OTLP).

## Run locally

```bash
cd backend
uv sync --extra dev          # create .venv and install deps
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API docs.

## Endpoints

| Method | Path                | Purpose                          |
| ------ | ------------------- | -------------------------------- |
| GET    | `/health`           | Liveness probe                   |
| GET    | `/ready`            | Readiness probe                  |
| POST   | `/api/ai/move`      | Next AI shot from its memory     |
| POST   | `/api/taunt`        | Taunt for a game event           |
| POST   | `/api/games`        | Record a finished game           |
| GET    | `/api/leaderboard`  | Top scores                       |

## Observability

The service exports OTLP to whatever `OTEL_EXPORTER_OTLP_ENDPOINT` points at.
With no endpoint configured it runs in no-export mode (still fully functional).

A ready-to-run local stack (OTel Collector → Jaeger + Prometheus + Grafana)
lives in [`../observability`](../observability). See the root
[`docs/HA_AND_OBSERVABILITY.md`](../docs/HA_AND_OBSERVABILITY.md) for details and
the high-availability story.

## Tests

```bash
uv run pytest
uv run ruff check .
```
