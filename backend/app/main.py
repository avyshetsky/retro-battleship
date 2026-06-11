"""Battleship backend API.

Serves three things, all instrumented with OpenTelemetry:
  * ``POST /api/ai/move``    — the AI opponent's next shot
  * ``POST /api/taunt``      — a contextual smack-talk line
  * ``/api/games`` & ``/api/leaderboard`` — high-score tracking

Plus ``/health`` (liveness) and ``/ready`` (readiness) for orchestrators.

The service is stateless apart from the optional leaderboard file, which makes
it safe to run as multiple replicas behind a load balancer (see the HA notes in
the repo README).
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from . import __version__
from .game.ai import AIMemory, choose_move
from .game.taunts import VALID_EVENTS, get_taunt
from .leaderboard import Leaderboard
from .models import (
    AiMoveRequest,
    AiMoveResponse,
    CoordModel,
    GameResult,
    HealthResponse,
    LeaderboardResponse,
    TauntRequest,
    TauntResponse,
)
from .telemetry import count, get_tracer, record, setup_telemetry

# Persist to a mounted volume when one is present (e.g. Fly mounts at /data), so
# the leaderboard is shared across every visitor and survives restarts. Falls
# back to in-memory when no writable volume exists.
_default_leaderboard_path = "/data/leaderboard.json" if os.path.isdir("/data") else None
leaderboard = Leaderboard(path=os.getenv("LEADERBOARD_PATH", _default_leaderboard_path))


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_telemetry()
    yield


app = FastAPI(
    title="Battleship API",
    version=__version__,
    description="OpenTelemetry-instrumented AI opponent, taunts, and leaderboard.",
    lifespan=lifespan,
)

# Allow the static frontend (served from a different origin) to call us.
_origins = os.getenv("CORS_ALLOW_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _origins == "*" else [o.strip() for o in _origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

tracer = get_tracer()


@app.get("/health", response_model=HealthResponse, tags=["ops"])
def health() -> HealthResponse:
    """Liveness probe — process is up."""
    return HealthResponse(status="ok", version=__version__)


@app.get("/ready", response_model=HealthResponse, tags=["ops"])
def ready() -> HealthResponse:
    """Readiness probe — ready to serve traffic."""
    return HealthResponse(status="ready", version=__version__)


@app.get("/", tags=["ops"])
def root() -> dict[str, str]:
    return {"service": "battleship-api", "version": __version__, "docs": "/docs"}


@app.post("/api/ai/move", response_model=AiMoveResponse, tags=["game"])
def ai_move(req: AiMoveRequest) -> AiMoveResponse:
    """Compute the AI opponent's next shot from its current memory."""
    start = time.perf_counter()
    with tracer.start_as_current_span("ai.choose_move") as span:
        span.set_attribute("ai.difficulty", req.difficulty)
        span.set_attribute("ai.tried_count", len(req.tried))
        span.set_attribute("ai.active_hits", len(req.active_hits))

        mem = AIMemory(
            difficulty=req.difficulty,
            tried={_parse_key(k) for k in req.tried},
            active_hits=[(c.row, c.col) for c in req.active_hits],
            target_queue=[(c.row, c.col) for c in req.target_queue],
        )
        try:
            row, col = choose_move(mem)
        except ValueError as exc:
            span.record_exception(exc)
            raise HTTPException(status_code=409, detail="board fully explored") from exc

        span.set_attribute("ai.move.row", row)
        span.set_attribute("ai.move.col", col)

    elapsed_ms = (time.perf_counter() - start) * 1000
    count("battleship.ai_moves", "AI moves served", {"difficulty": req.difficulty})
    record("battleship.ai_move_latency", "AI move computation latency", elapsed_ms,
           attributes={"difficulty": req.difficulty})
    return AiMoveResponse(move=CoordModel(row=row, col=col))


@app.post("/api/taunt", response_model=TauntResponse, tags=["game"])
def taunt(req: TauntRequest) -> TauntResponse:
    """Return a contextual taunt for a game event."""
    with tracer.start_as_current_span("taunt.generate") as span:
        span.set_attribute("taunt.event", req.event)
        if req.event not in VALID_EVENTS:
            raise HTTPException(status_code=400, detail=f"unknown event: {req.event}")
        text = get_taunt(req.event)
    count("battleship.taunts", "Taunts served", {"event": req.event})
    return TauntResponse(text=text, event=req.event)


@app.post("/api/games", response_model=LeaderboardResponse, tags=["game"])
def record_game(result: GameResult) -> LeaderboardResponse:
    """Record a finished game and return the updated leaderboard."""
    with tracer.start_as_current_span("leaderboard.record") as span:
        span.set_attribute("game.won", result.won)
        span.set_attribute("game.shots", result.shots)
        span.set_attribute("game.difficulty", result.difficulty)
        leaderboard.add(result)
    count(
        "battleship.games",
        "Games recorded",
        {"won": str(result.won).lower(), "difficulty": result.difficulty},
    )
    return LeaderboardResponse(entries=leaderboard.top())


@app.get("/api/leaderboard", response_model=LeaderboardResponse, tags=["game"])
def get_leaderboard() -> LeaderboardResponse:
    return LeaderboardResponse(entries=leaderboard.top())


def _parse_key(key: str) -> tuple[int, int]:
    row, col = key.split(",")
    return int(row), int(col)


# Instrument FastAPI for distributed tracing of every request.
FastAPIInstrumentor.instrument_app(app)
