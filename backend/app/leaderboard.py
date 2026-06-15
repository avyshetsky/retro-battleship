"""A tiny leaderboard store.

By default it keeps the top scores in memory. When ``LEADERBOARD_PATH`` is set
the JSON file becomes the source of truth: every read and write re-reads the
file under a lock and writes are atomic (temp file + ``os.replace``). Pointing
multiple replicas at one shared volume therefore gives a consistent leaderboard
across the whole HA fleet without a separate datastore. For higher write volume
you would swap this for Redis/Postgres — the interface is deliberately small to
make that easy.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import UTC, datetime

from .models import GameResult, LeaderboardEntry

MAX_ENTRIES = 10


class Leaderboard:
    def __init__(self, path: str | None = None) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._entries: list[LeaderboardEntry] = []
        self._load()

    def _load(self) -> None:
        if not self._path or not os.path.exists(self._path):
            return
        try:
            with open(self._path, encoding="utf-8") as fh:
                raw = json.load(fh)
            self._entries = [LeaderboardEntry(**e) for e in raw]
        except (OSError, ValueError):
            # Corrupt or unreadable file should never crash the service.
            self._entries = []

    def _persist(self) -> None:
        if not self._path:
            return
        try:
            # Atomic write so a concurrent reader never sees a half-written file.
            tmp = f"{self._path}.{os.getpid()}.tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump([json.loads(e.model_dump_json()) for e in self._entries], fh)
            os.replace(tmp, self._path)
        except OSError:
            pass

    def add(self, result: GameResult) -> LeaderboardEntry:
        entry = LeaderboardEntry(
            **result.model_dump(),
            created_at=datetime.now(UTC),
        )
        with self._lock:
            # Re-read the shared file so writes from sibling replicas aren't lost.
            self._load()
            self._entries.append(entry)
            # Only wins rank; sort by fewest shots, then most recent.
            self._entries = sorted(
                [e for e in self._entries if e.won],
                key=lambda e: (e.shots, -e.created_at.timestamp()),
            )[:MAX_ENTRIES]
            self._persist()
        return entry

    def top(self) -> list[LeaderboardEntry]:
        with self._lock:
            # Re-read so every replica reflects the latest shared state.
            self._load()
            return list(self._entries)
