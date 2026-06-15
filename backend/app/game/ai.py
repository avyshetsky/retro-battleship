"""Server-side Battleship AI.

This is a faithful port of the client's ``ai.ts`` so the backend can serve the
opponent's moves. The AI only ever reasons about the results of its *own*
shots (which the client passes in), so it never cheats by reading ship
positions.

The board is 10x10. Coordinates are ``(row, col)`` tuples, zero-indexed.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

BOARD_SIZE = 10

Coord = tuple[int, int]

Difficulty = str  # one of: "easy", "medium", "hard"

_NEIGHBOURS: tuple[Coord, ...] = ((-1, 0), (1, 0), (0, -1), (0, 1))


def in_bounds(c: Coord) -> bool:
    """Whether a coordinate lies on the board."""
    row, col = c
    return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE


@dataclass
class AIMemory:
    """Everything the AI remembers between shots.

    Mirrors the client's ``AIState``. ``tried`` holds every cell already fired
    at, ``active_hits`` are the unresolved hits on the ship currently being
    hunted, and ``target_queue`` are promising neighbours to try next.
    """

    difficulty: Difficulty = "hard"
    tried: set[Coord] = field(default_factory=set)
    active_hits: list[Coord] = field(default_factory=list)
    target_queue: list[Coord] = field(default_factory=list)


def _line_extensions(mem: AIMemory) -> list[Coord]:
    """Cells that extend a straight line of two-or-more in-line hits."""
    hits = mem.active_hits
    if len(hits) < 2:
        return []

    same_row = all(h[0] == hits[0][0] for h in hits)
    same_col = all(h[1] == hits[0][1] for h in hits)
    if not same_row and not same_col:
        return []

    extensions: list[Coord] = []
    if same_row:
        row = hits[0][0]
        cols = [h[1] for h in hits]
        extensions.append((row, min(cols) - 1))
        extensions.append((row, max(cols) + 1))
    else:
        col = hits[0][1]
        rows = [h[0] for h in hits]
        extensions.append((min(rows) - 1, col))
        extensions.append((max(rows) + 1, col))

    return [c for c in extensions if in_bounds(c) and c not in mem.tried]


def _available_cells(mem: AIMemory) -> list[Coord]:
    return [
        (r, c)
        for r in range(BOARD_SIZE)
        for c in range(BOARD_SIZE)
        if (r, c) not in mem.tried
    ]


def choose_move(mem: AIMemory, rng: random.Random | None = None) -> Coord:
    """Choose the AI's next target. Pure aside from the supplied RNG."""
    rng = rng or random

    if mem.difficulty != "easy":
        # 1. Finish a wounded ship by extending the hit line.
        extensions = _line_extensions(mem)
        if extensions:
            return rng.choice(extensions)

        # 2. Probe queued neighbours of an isolated hit (skip stale entries).
        queued = [c for c in mem.target_queue if in_bounds(c) and c not in mem.tried]
        if queued:
            return queued[0]

    available = _available_cells(mem)
    if not available:
        raise ValueError("no available cells remain")

    # 3. Hard mode: search a checkerboard to find ships in the fewest shots.
    if mem.difficulty == "hard":
        parity = [c for c in available if (c[0] + c[1]) % 2 == 0]
        if parity:
            return rng.choice(parity)

    return rng.choice(available)


def register_result(mem: AIMemory, target: Coord, result: str) -> AIMemory:
    """Return updated memory after observing the result of ``target``.

    ``result`` is one of ``"miss"``, ``"hit"``, ``"sunk"`` or ``"already"``.
    """
    if result == "already":
        return mem

    mem.tried.add(target)

    if result == "hit":
        mem.active_hits.append(target)
        for dr, dc in _NEIGHBOURS:
            n = (target[0] + dr, target[1] + dc)
            if in_bounds(n) and n not in mem.tried:
                mem.target_queue.append(n)
    elif result == "sunk":
        mem.active_hits = []
        mem.target_queue = []

    return mem
