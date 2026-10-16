# core-backend

The public REST API for the exchange. It sits in front of `core-trading-engine` and never
touches the order book, balances or positions directly — every mutating or order-facing
request is turned into a message on the `engine.request` Redis Stream and the engine's
response is read back off `engine.response`. Auth, sessions, OTP email and admin bootstrap
live here; matching, balances and positions live in the engine.

## What it does

- Signup/signin, OTP verification and session/JWT auth (`auth-controller`)
- Admin asset & market management (`asset-controller`, `market-controller`, `market-additional-controller`)
- Deposits/withdrawals — balance on-ramp/off-ramp (`fund-controller`)
- Order placement, cancellation and open-order queries (`order-controller`)
- Position queries (`position-controller`)
- Market data: depth, tickers, trades, klines and history (`depth-controller`, `ticker-controller`,
  `trade-controller`, `klines-controller`, `history-controller`)
- Idempotency for retried mutating requests (`idempotency.middleware`)

All routes are mounted under `/api/v1` (see `src/routers/index.ts`).

## Port & health checks

| | |
|---|---|
| Port | `8080` (env `PORT`) |
| Liveness | `GET /api/v1/alive` — always 200 once the process is up |
| Readiness | `GET /api/v1/ready` — 200 only once Redis is connected **and** the trading engine responds to a health-check event; 503 otherwise |

```bash
curl http://localhost:8080/api/v1/alive
curl http://localhost:8080/api/v1/ready
```

## Environment variables

See `.env.example` for the full list. Required at boot (the process throws on startup if any
are missing):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (read-mostly; writes to the DB happen via `database-engine`, not here) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis Streams connection used to talk to the trading engine |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_PASSWORD_REFRESH_SECRET` / `JWT_OTP_SECRET` | Signing secrets for the four distinct token types this service issues |
| `FRONTEND_URL` | Comma-separated list of origins allowed through CORS |
| `ADMIN_KEY` | Shared secret used to bootstrap the first admin user |
| `RESEND_API_KEY` / `MAIL_FROM` | Outbound email (OTP, notifications) via Resend |
| `PORT` | HTTP port (default `8080`) |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost (default `10`) |

## Scripts

```bash
bun run dev     # bun --watch, restarts on file change
bun run start   # bun src/index.ts
bun run build   # tsc -> dist/
bun run test    # jest --detectOpenHandles
bun run lint    # tsc --noEmit + eslint
```

## Depends on

- `@workspace/database` (Prisma/Postgres, read paths)
- `@workspace/redis-streams` (Redis Streams client)
- `@workspace/shared` (event contracts, validation schemas)
- A running `core-trading-engine` for anything that touches orders/balances/positions

Run the whole stack together with `docker compose -f infra/docker-compose.dev.yml up -d`
from the repo root, or see the [root README](../../README.md) for local setup without Docker.
