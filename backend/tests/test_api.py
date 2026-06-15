"""Endpoint tests using FastAPI's TestClient."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_and_ready():
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["status"] == "ready"


def test_ai_move_returns_valid_coordinate():
    resp = client.post(
        "/api/ai/move",
        json={"difficulty": "hard", "tried": [], "active_hits": [], "target_queue": []},
    )
    assert resp.status_code == 200
    move = resp.json()["move"]
    assert 0 <= move["row"] <= 9
    assert 0 <= move["col"] <= 9


def test_ai_move_avoids_tried_cells():
    # All parity cells tried except one; hard mode must pick the remaining one.
    tried = [
        f"{r},{c}"
        for r in range(10)
        for c in range(10)
        if (r + c) % 2 == 0 and (r, c) != (0, 0)
    ]
    resp = client.post(
        "/api/ai/move",
        json={"difficulty": "hard", "tried": tried, "active_hits": [], "target_queue": []},
    )
    assert resp.status_code == 200
    assert resp.json()["move"] == {"row": 0, "col": 0}


def test_taunt_valid_event():
    resp = client.post("/api/taunt", json={"event": "ai_hit"})
    assert resp.status_code == 200
    assert resp.json()["text"]


def test_taunt_unknown_event_rejected():
    resp = client.post("/api/taunt", json={"event": "not_a_real_event"})
    assert resp.status_code == 400


def test_leaderboard_records_only_wins_sorted_by_shots():
    # losses are ignored, wins ranked by fewest shots
    client.post(
        "/api/games",
        json={"name": "LOSER", "won": False, "shots": 5, "difficulty": "easy"},
    )
    client.post(
        "/api/games",
        json={"name": "SLOW", "won": True, "shots": 80, "difficulty": "hard"},
    )
    resp = client.post(
        "/api/games",
        json={"name": "FAST", "won": True, "shots": 30, "difficulty": "hard"},
    )
    entries = resp.json()["entries"]
    names = [e["name"] for e in entries]
    assert "LOSER" not in names
    assert names.index("FAST") < names.index("SLOW")


def test_invalid_game_payload_rejected():
    resp = client.post(
        "/api/games",
        json={"name": "", "won": True, "shots": 10, "difficulty": "hard"},
    )
    assert resp.status_code == 422
