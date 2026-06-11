# High Availability & Observability

This document explains how Retro Battleship is made resilient and observable —
the "over-engineered to demonstrate quality" part of the project.

## Resilience layers

There are three independent layers of resilience, so a failure at any one level
does not take the game down:

1. **The game runs entirely in the browser.** All game state, rules, and a full
   copy of the AI live client-side. Even with the backend completely offline,
   the game is 100% playable — the UI flips to `LOCAL AI MODE`.

2. **Graceful API fallback.** Every backend call (`requestAiMove`,
   `requestTaunt`, `recordGame`, `fetchLeaderboard`) is wrapped with a timeout
   and a `try/catch` that falls back to local logic. A slow or erroring backend
   degrades gracefully instead of breaking the game. Backend status is surfaced
   in the UI (`ONLINE` / `OFFLINE` / `LOCAL`).

3. **Horizontal scalability.** The backend is **stateless** (the only state is
   an optional leaderboard file, easily swapped for Redis/Postgres). That means
   it can run as **N replicas** behind a load balancer with no coordination.

## High-availability demo

`observability/docker-compose.yml` runs **two API replicas** (`api1`, `api2`)
behind an **nginx** round-robin load balancer (`observability/nginx.conf`):

```
client ─▶ nginx :8080 ─┬─▶ api1:8000
                       └─▶ api2:8000
```

nginx is configured with `proxy_next_upstream`, so if one replica fails a
request it is transparently retried against the other. Kill a replica
(`docker compose stop api1`) and the game keeps serving from `api2`.

### Liveness & readiness

The API exposes Kubernetes-style probes:

- `GET /health` — **liveness**: the process is up.
- `GET /ready` — **readiness**: ok to receive traffic.

In Kubernetes these map directly to `livenessProbe` / `readinessProbe`, letting
the orchestrator restart unhealthy pods and only route to ready ones.

## Observability (OpenTelemetry)

The backend is instrumented with **OpenTelemetry** for both traces and metrics,
exported via **OTLP** to an **OpenTelemetry Collector**, which fans out to:

- **Jaeger** for distributed traces
- **Prometheus** for metrics
- **Grafana** for dashboards (auto-provisioned)

```
API (OTLP/HTTP :4318) ─▶ OTel Collector ─┬─▶ Jaeger   (:16686)
                                          └─▶ Prometheus (:9090) ─▶ Grafana (:3000)
```

### Traces

Each request is auto-traced by `FastAPIInstrumentor`, and we add custom spans
with domain attributes:

- `ai.choose_move` — `ai.difficulty`, `ai.tried_count`, `ai.move.row/col`
- `taunt.generate` — `taunt.event`
- `leaderboard.record` — `game.won`, `game.shots`, `game.difficulty`

### Metrics

| Metric                                  | Type      | Labels              |
| --------------------------------------- | --------- | ------------------- |
| `battleship.ai_moves`                   | counter   | `difficulty`        |
| `battleship.ai_move_latency` (ms)       | histogram | `difficulty`        |
| `battleship.taunts`                     | counter   | `event`             |
| `battleship.games`                      | counter   | `won`, `difficulty` |

A starter Grafana dashboard (`observability/grafana/.../battleship.json`)
visualizes move/taunt rates, p95 AI latency, and games recorded.

### Configuration

Everything is driven by standard `OTEL_*` env vars, so you can point the backend
at **any** OTLP-compatible backend (Honeycomb, Grafana Cloud, Datadog, ...):

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=battleship-api
```

If no endpoint is configured, telemetry runs in **no-export mode** — the app is
fully functional, it just doesn't ship spans/metrics. This keeps local dev and
the public demo frictionless.

## Production notes / next steps

- Swap the file-based leaderboard for Redis/Postgres to share state across
  replicas.
- Add `OTEL_TRACES_SAMPLER=parentbased_traceidratio` with a ratio for
  high-traffic sampling.
- Add an HPA (Horizontal Pod Autoscaler) keyed on `battleship.ai_move_latency`.
