# database-engine

The write path from the trading engine into Postgres. It's a dedicated consumer-group member
(`database-engine-group`) on the `engine.response` Redis Stream — every update the engine emits
(assets, markets, users, balances, orders, trades, positions, liquidations, commissions) gets
persisted here via Prisma. Nothing else in the system writes trading data to Postgres; this is
persistence *of record*, not the source of truth (the engine's in-memory state + R2 snapshots is).

## What it does

- `applyAssets` / `applyMarkets` / `applyUser` — admin and account bootstrap data
- `applyBalances` / `applyCommissions` — balance transactions and commission/insurance fund totals
- `applyOrders` / `applyTrades` — order lifecycle and executed fills
- `applyClosedPositions` — normal closes and liquidation/ADL closes

## Port & health checks

| | |
|---|---|
| Port | `8082` (env `PORT`) |
| Liveness | `GET /alive` — 200 once the process is up |
| Readiness | `GET /ready` — 200 only if `SELECT 1` succeeds against Postgres; 503 otherwise |

```bash
curl http://localhost:8082/alive
curl http://localhost:8082/ready
```

## Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port for the health-check server (default `8082`) |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis Streams connection |
| `DATABASE_ENGINE_BATCH_SIZE` | Max messages read per Redis `XREADGROUP` call |
| `DATABASE_ENGINE_BLOCK_TIME_MS` | Blocking read timeout on the consumer loop |

## Scripts

```bash
bun run dev     # bun --watch, restarts on file change
bun run start   # bun src/index.ts
bun run build   # tsc -> dist/
bun run test    # jest --detectOpenHandles
bun run lint    # tsc --noEmit + eslint
```

## Depends on

- `@workspace/database` (Prisma/Postgres writes)
- `@workspace/redis-streams` (consumer-group reader on `engine.response`)
- `@workspace/shared` (update-bundle types)
- A running `core-trading-engine` producing updates on `engine.response`

Run the whole stack together with `docker compose -f infra/docker-compose.dev.yml up -d`
from the repo root, or see the [root README](../../README.md) for local setup without Docker.
