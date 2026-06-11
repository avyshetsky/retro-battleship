"""Pydantic request/response models for the API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Difficulty = Literal["easy", "medium", "hard"]


class CoordModel(BaseModel):
    row: int = Field(ge=0, le=9)
    col: int = Field(ge=0, le=9)


class AiMoveRequest(BaseModel):
    """The AI's current memory, sent by the client each turn."""

    difficulty: Difficulty = "hard"
    tried: list[str] = Field(default_factory=list, description="Coordinate keys 'row,col'")
    active_hits: list[CoordModel] = Field(default_factory=list)
    target_queue: list[CoordModel] = Field(default_factory=list)


class AiMoveResponse(BaseModel):
    move: CoordModel


class TauntRequest(BaseModel):
    event: str


class TauntResponse(BaseModel):
    text: str
    event: str


class GameResult(BaseModel):
    name: str = Field(min_length=1, max_length=16)
    won: bool
    shots: int = Field(ge=0, le=200)
    difficulty: Difficulty


class LeaderboardEntry(GameResult):
    created_at: datetime


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]


class HealthResponse(BaseModel):
    status: str
    version: str
