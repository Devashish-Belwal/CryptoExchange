# ws-server

The public WebSocket gateway. It has no state and no business logic of its own — it's a
consumer-group reader on the `engine.response` Redis Stream (`ws-server-group`) that fans every
depth/ticker/mark-price/trade/order/position update the trading engine emits out to whichever
browser clients are subscribed to that market and channel.

## What it does

- Accepts WebSocket connections on `/ws`
- Lets clients `subscribe`/`unsubscribe` to a `(channel, symbol)` pair, where `channel` is one of
  `depth`, `ticker`, `markprice`, `trade` (see `src/channels.ts`)
- Reads the engine's per-tick `BaseUpdate` bundle off Redis and pushes only the slices a given
  client is subscribed to
- Tracks connected-client count and Redis connectivity for its readiness check

## Port & health checks

| | |
|---|---|
| Port | `8083` (env `WS_PORT`) |
| WebSocket path | `ws://localhost:8083/ws` |
| Liveness | `GET /alive` — 200 once the process is up |
| Readiness | `GET /ready` — 200 only once the WebSocket server is running **and** Redis is connected; 503 otherwise |

```bash
curl http://localhost:8083/alive
curl http://localhost:8083/ready
```

## Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `WS_PORT` | HTTP/WebSocket port (default `8083`) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis Streams connection |
| `WS_SERVER_BATCH_SIZE` | Max messages read per Redis `XREADGROUP` call |
| `WS_SERVER_BLOCK_TIME_MS` | Blocking read timeout on the consumer loop |

## Scripts

```bash
bun run dev     # bun --watch, restarts on file change
bun run start   # bun src/index.ts
bun run build   # tsc -> dist/
bun run test    # jest --detectOpenHandles
bun run lint    # tsc --noEmit + eslint
```

## Depends on

- `@workspace/redis-streams` (consumer-group reader on `engine.response`)
- `@workspace/shared` (update-bundle types)
- A running `core-trading-engine` producing updates on `engine.response`

Run the whole stack together with `docker compose -f infra/docker-compose.dev.yml up -d`
from the repo root, or see the [root README](../../README.md) for local setup without Docker.
