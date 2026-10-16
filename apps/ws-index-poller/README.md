# ws-index-poller

The exchange's only external market-data dependency. It subscribes to Binance's mark-price
websocket, maps Binance's symbols onto this exchange's internal PERP market symbols
(`BTCUSDT` -> `BTC_PERP`, etc.), and republishes each tick as an `INDEX_PRICE_UPDATE_EVENT` on
the `engine.request` Redis Stream — this is what drives the trading engine's liquidation checks.
It also runs the hourly funding-rate scheduler.

## What it does

- Connects to `wss://fstream.binance.com/market/ws/!markPrice@arr@1s` and re-emits every mark-price
  tick (~1/s per market) to `core-trading-engine`
- Auto-reconnects the Binance socket on drop
- On a fixed interval (default hourly), publishes a `FUNDING_RATE_UPDATE_EVENT` per known market,
  triggering the engine's funding settlement pass
- Tracks last-message age so its readiness check fails if ticks go stale

## Port & health checks

| | |
|---|---|
| Port | `8084` (env `PORT`) |
| Liveness | `GET /alive` — 200 once the process is up |
| Readiness | `GET /ready` — 200 only if the Binance websocket is connected, Redis is connected, **and** a mark-price message has arrived within `STALE_AFTER_MS`; 503 otherwise |

```bash
curl http://localhost:8084/alive
curl http://localhost:8084/ready
```

## Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port for the health-check server (default `8084`) |
| `STALE_AFTER_MS` | How old the last mark-price message can be before `/ready` reports unhealthy (default `10000`) |
| `FUNDING_INTERVAL_SECONDS` | How often the funding-rate settlement event fires (default `3600`) |
| `BINANCE_MARK_PRICE_STREAM_URL` | Upstream Binance mark-price stream URL |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis Streams connection |

## Scripts

```bash
bun run dev     # bun --watch, restarts on file change
bun run start   # bun src/index.ts
bun run build   # tsc -> dist/
bun run test    # jest --detectOpenHandles
bun run lint    # tsc --noEmit + eslint
```

## Depends on

- `@workspace/redis-streams` (publisher onto `engine.request`)
- `@workspace/shared` (event payload types)
- A running `core-trading-engine` to consume the index-price and funding events

Run the whole stack together with `docker compose -f infra/docker-compose.dev.yml up -d`
from the repo root, or see the [root README](../../README.md) for local setup without Docker.
