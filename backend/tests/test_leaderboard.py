"""Tests for the leaderboard store, including shared-file HA consistency."""

from app.leaderboard import Leaderboard
from app.models import GameResult


def _win(name: str, shots: int) -> GameResult:
    return GameResult(name=name, won=True, shots=shots, difficulty="hard")


def test_in_memory_records_only_wins_sorted_by_shots():
    lb = Leaderboard()
    lb.add(GameResult(name="LOSER", won=False, shots=5, difficulty="easy"))
    lb.add(_win("SLOW", 80))
    lb.add(_win("FAST", 30))
    names = [e.name for e in lb.top()]
    assert "LOSER" not in names
    assert names.index("FAST") < names.index("SLOW")


def test_shared_file_is_consistent_across_replicas(tmp_path):
    # Two independent instances pointing at the same file model two HA replicas
    # behind a load balancer. A write on one must be visible from the other.
    path = str(tmp_path / "leaderboard.json")
    replica_a = Leaderboard(path=path)
    replica_b = Leaderboard(path=path)

    replica_a.add(_win("ADMIRAL", 34))
    # replica_b never saw the write in-process, but re-reads the shared file.
    assert [e.name for e in replica_b.top()] == ["ADMIRAL"]

    # A subsequent write on B must not clobber A's entry, and ranking holds.
    replica_b.add(_win("FASTER", 20))
    names = [e.name for e in replica_a.top()]
    assert names == ["FASTER", "ADMIRAL"]
