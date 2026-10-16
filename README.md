# CEX

A centralized crypto exchange backend: a custom spot + perpetuals matching engine, the REST API
and supporting services (persistence, WebSocket fan-out, an external mark-price feed and a
reverse proxy) around it, built as a Bun/Turborepo TypeScript monorepo.

## Architecture at a glance

Nothing talks to the trading engine over HTTP. Every order, balance change and admin action is a
message on the `engine.request` Redis Stream; every effect the engine produces is a message on
`engine.response`, which `database-engine` and `ws-server` each consume independently as their
own consumer group.

```
core-backend ───────┐
(REST API)          ├──▶ engine.request ──▶ core-trading-engine ──▶ engine.response ──┬──▶ database-engine ──▶ Postgres
ws-index-poller ────┘   (Redis Stream)     (matching, balances,     (Redis Stream)       │
(Binance mark price)                         positions, funding)                         └──▶ ws-server ──▶ browser clients
                                                    │                                         (WebSocket)
                                                    └──▶ Cloudflare R2 (daily snapshots)

proxy-server ──▶ Backpack Exchange REST API (public market-data proxy, independent of the above)
``` 

See [`apps/core-trading-engine/README.md`](apps/core-trading-engine/README.md) for a full
deep-dive on the engine itself (order creation, liquidation/ADL, funding settlement, commission
& insurance funds, the update-bundle fan-out and the full event catalog), and
[`docs/deployment.md`](docs/deployment.md) for how this is actually shipped.

## Services

| Service | Port | Alive | Ready | What it does |
|---|---|---|---|---|
| [`core-backend`](apps/core-backend) | `8080` | `/api/v1/alive` | `/api/v1/ready` | REST API: auth, admin, orders, balances, market data |
| [`core-trading-engine`](apps/core-trading-engine) | `8081` | `/alive` | `/ready` | Matching engine: order book, balances, positions, funding, liquidation |
| [`database-engine`](apps/database-engine) | `8082` | `/alive` | `/ready` | Persists every engine update to Postgres |
| [`ws-server`](apps/ws-server) | `8083` | `/alive` | `/ready` | WebSocket fan-out of engine updates to browser clients |
| [`ws-index-poller`](apps/ws-index-poller) | `8084` | `/alive` | `/ready` | Binance mark-price feed + hourly funding-rate scheduler |
| [`proxy-server`](apps/proxy-server) | `8085` | `/alive` | `/ready` | Reverse proxy to Backpack Exchange's public REST API |
| [`debug-console`](apps/debug-console) | `3002` | – | – | Internal terminal-styled debug UI (Next.js) |

Every backend service exposes the same two health routes for container orchestration:
`/alive` (liveness — process is up) and `/ready` (readiness — its actual dependencies, e.g.
Redis/Postgres/the engine/an upstream API, are reachable). See each service's own README for
exact response shapes.

## Shared packages

| Package | Purpose |
|---|---|
| [`packages/database`](packages/database) | Prisma schema, migrations and the shared Postgres client |
| [`packages/shared`](packages/shared) | Cross-service TypeScript types and `zod` validation schemas |
| [`packages/redis-stream`](packages/redis-stream) | Redis Streams client/publisher/consumer wrapper |
| [`packages/ui`](packages/ui) | Shared shadcn/ui component library used by all three frontends |
| [`packages/typescript-config`](packages/typescript-config) / [`packages/eslint-config`](packages/eslint-config) | Shared tooling config |

## Folder structure

```
.
├── apps/
│   ├── core-backend/           Express REST API
│   ├── core-trading-engine/    the matching engine
│   ├── database-engine/        Redis -> Postgres persistence writer
│   ├── ws-server/               WebSocket broadcast gateway
│   ├── ws-index-poller/        Binance mark-price + funding-rate poller
│   ├── proxy-server/            reverse proxy to Backpack Exchange
│   ├── debug-console/          internal debug UI (Next.js)
│   └── integration-tests/      end-to-end test suite (not part of this repo's history/remote)
├── packages/
│   ├── database/               Prisma schema + client
│   ├── shared/                 cross-service types & validation schemas
│   ├── redis-stream/           Redis Streams wrapper
│   ├── ui/                     shared shadcn/ui components
│   ├── typescript-config/      shared tsconfig bases
│   └── eslint-config/          shared eslint config
├── infra/
│   ├── docker-compose.dev.yml  full local stack (Postgres, Redis, every service)
│   ├── docker-compose.prod.yml production stack
│   └── dockerfile/             one Dockerfile per service
├── docs/
│   └── local-ports.txt         quick port reference for local dev
├── turbo.json                  Turborepo task graph (build/dev/lint/format/typecheck)
└── package.json                workspace root (apps/*, packages/*)
```

## Prerequisites

- [Bun](https://bun.com) `1.3.14` or newer (the package manager and runtime for every service)
- Node.js `>=20` (used by some tooling alongside Bun)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose (for Postgres/Redis, and
  optionally for running every service in containers)

## Clone

```bash
git clone https://github.com/<name>/centralized-exchange.git
cd centralized-exchange
bun install
```

## Running locally

### Option A — everything in Docker

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

This starts Postgres (`timescale/timescaledb:latest-pg16`, port `5432`), Redis
(`redis:7.4-alpine`, port `6379`) and every backend service, each bind-mounted from the repo so
`bun --watch` still picks up local file changes. See `docs/local-ports.txt` for the full port
map, including the three Next.js frontends (run separately via `bun run dev`, see below).

### Option B — infra in Docker, services on the host

```bash
docker compose -f infra/docker-compose.dev.yml up -d db redis
```

Then, for each service you want to run (`apps/core-backend`, `apps/core-trading-engine`,
`apps/database-engine`, `apps/ws-server`, `apps/ws-index-poller`, `apps/proxy-server`):

```bash
cp apps/<service>/.env.example apps/<service>/.env   # fill in secrets
bun run --cwd apps/<service> dev
```

For the Prisma schema, run migrations once against the local Postgres before starting anything
that reads/writes the database:

```bash
cd packages/database
cp .env.example .env   # if present, otherwise set DATABASE_URL directly
bunx prisma migrate deploy
```

### Frontend (Debug Console)

```bash
bun run dev   # runs turbo dev for every app, including debug-console
```

or target the debug console: `bun run --cwd apps/debug-console dev`.

## Environment variables

Each service ships its own `.env.example` — copy it to `.env` in that service's folder and fill
in the secrets before running it outside Docker (the dev Compose file injects the container-network
values like `DATABASE_URL`/`REDIS_HOST` for you). See each service's own README for exactly which
variables it requires and what they're for.

## Root-level scripts

```bash
bun run build       # turbo build — builds every app/package
bun run dev          # turbo dev — runs every app/package in watch mode
bun run lint         # turbo lint
bun run format       # turbo format
bun run typecheck    # turbo typecheck
```

Turborepo caches and parallelizes these across the whole workspace; running the same script
inside a single `apps/*` or `packages/*` folder runs it for just that project.

## Further reading

- [`apps/core-trading-engine/README.md`](apps/core-trading-engine/README.md) — full engine
  architecture: event loop, order book internals, balances, positions, liquidation/ADL, funding
  settlement, commission & insurance funds, the update bundle, the full event catalog
- [`docs/deployment.md`](docs/deployment.md) — how this is deployed
- [`docs/local-ports.txt`](docs/local-ports.txt) — quick local port reference
