"""Tests for the server-side AI, mirroring the client's AI test suite."""

import random

from app.game.ai import BOARD_SIZE, AIMemory, choose_move, in_bounds, register_result


def test_never_repeats_over_full_sweep():
    rng = random.Random(123)
    mem = AIMemory(difficulty="hard")
    seen = set()
    for _ in range(BOARD_SIZE * BOARD_SIZE):
        move = choose_move(mem, rng)
        assert move not in seen
        seen.add(move)
        register_result(mem, move, "miss")
    assert len(seen) == BOARD_SIZE * BOARD_SIZE


def test_hard_mode_uses_checkerboard_first():
    rng = random.Random(99)
    mem = AIMemory(difficulty="hard")
    for _ in range(50):
        move = choose_move(mem, rng)
        assert (move[0] + move[1]) % 2 == 0
        register_result(mem, move, "miss")


def test_targets_neighbour_after_hit():
    mem = AIMemory(difficulty="medium")
    register_result(mem, (5, 5), "hit")
    move = choose_move(mem, random.Random(1))
    assert abs(move[0] - 5) + abs(move[1] - 5) == 1


def test_extends_line_after_two_hits():
    mem = AIMemory(difficulty="medium")
    register_result(mem, (5, 5), "hit")
    register_result(mem, (5, 6), "hit")
    move = choose_move(mem, random.Random(2))
    assert move[0] == 5
    assert move[1] in (4, 7)


def test_memory_cleared_after_sink():
    mem = AIMemory(difficulty="medium")
    register_result(mem, (5, 5), "hit")
    register_result(mem, (5, 6), "sunk")
    assert mem.active_hits == []
    assert mem.target_queue == []


def test_in_bounds():
    assert in_bounds((0, 0))
    assert in_bounds((9, 9))
    assert not in_bounds((-1, 0))
    assert not in_bounds((0, 10))


def test_easy_mode_is_pure_random_but_valid():
    rng = random.Random(5)
    mem = AIMemory(difficulty="easy")
    move = choose_move(mem, rng)
    assert in_bounds(move)
