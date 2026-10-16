# CEX (Centralized Crypto Exchange)

A high-performance centralized crypto exchange backend: a custom spot + perpetuals matching engine, REST API, persistence worker, WebSocket fan-out, Binance mark-price poller, reverse proxy, and a terminal-styled Next.js debug console, built as a Bun/Turborepo TypeScript monorepo.

---

## Architecture at a Glance

Nothing talks to the trading engine over HTTP. Every order, balance change, and admin action is published as an event on the `engine.request` Redis Stream. Every effect the engine produces is published on `engine.response`, which `database-engine` and `ws-server` consume independently as their own consumer groups.

```
core-backend ───────┐
(REST API)          ├──▶ engine.request ──▶ core-trading-engine ──▶ engine.response ──┬──▶ database-engine ──▶ Postgres (TimescaleDB)
ws-index-poller ────┘   (Redis Stream)     (matching, balances,     (Redis Stream)       │
(Binance mark price)                         positions, funding)                         └──▶ ws-server ──▶ browser clients
                                                    │                                         (WebSocket)
                                                    └──▶ Cloudflare R2 (daily snapshots)

proxy-server ──▶ Backpack Exchange REST API (public market-data proxy, independent of the above)
```

---

## Services & Applications

| Service | Port | Liveness (`/alive`) | Readiness (`/ready`) | Description |
|---|---|---|---|---|
| [`core-backend`](apps/core-backend) | `8080` | `/api/v1/alive` | `/api/v1/ready` | Express REST API: auth, JWT, OTP, admin, orders, balances |
| [`core-trading-engine`](apps/core-trading-engine) | `8081` | `/alive` | `/ready` | Matching engine: order book, balances, positions, funding, liquidations |
| [`database-engine`](apps/database-engine) | `8082` | `/alive` | `/ready` | Persists Redis engine events to TimescaleDB / Postgres |
| [`ws-server`](apps/ws-server) | `8083` | `/alive` | `/ready` | WebSocket broadcast gateway for live order books & trades |
| [`ws-index-poller`](apps/ws-index-poller) | `8084` | `/alive` | `/ready` | Binance mark-price streamer & hourly funding-rate scheduler |
| [`proxy-server`](apps/proxy-server) | `8085` | `/alive` | `/ready` | Reverse proxy to Backpack Exchange's public REST API |
| [`debug-console`](apps/debug-console) | `3002` | – | – | Terminal-styled trading & admin web console (Next.js) |

Every backend service exposes standard orchestration endpoints:
* `/alive`: Liveness check — verifies process is up and running.
* `/ready`: Readiness check — verifies underlying dependencies (Postgres, Redis, R2) are connected and ready to process traffic.

---

## Shared Packages

| Package | Purpose |
|---|---|
| [`packages/database`](packages/database) | Prisma schema, migrations, and shared PostgreSQL / TimescaleDB client |
| [`packages/shared`](packages/shared) | Cross-service TypeScript types and Zod validation schemas |
| [`packages/redis-stream`](packages/redis-stream) | Redis Streams wrapper (publishers, consumer groups, ack handlers) |
| [`packages/ui`](packages/ui) | Shared component library (shadcn/ui, Tailwind CSS) used by `debug-console` |
| [`packages/typescript-config`](packages/typescript-config) | Shared `tsconfig.json` bases |
| [`packages/eslint-config`](packages/eslint-config) | Shared ESLint configurations |

---

## Folder Structure

```
.
├── apps/
│   ├── core-backend/           Express REST API
│   ├── core-trading-engine/    In-memory matching engine
│   ├── database-engine/        Redis -> Postgres persistence writer
│   ├── ws-server/              WebSocket broadcast gateway
│   ├── ws-index-poller/        Binance mark-price + funding-rate poller
│   ├── proxy-server/           Reverse proxy to Backpack Exchange
│   └── debug-console/          Terminal-styled debug & admin UI (Next.js)
├── packages/
│   ├── database/               Prisma schema + client
│   ├── shared/                 Cross-service types & validation schemas
│   ├── redis-stream/           Redis Streams client wrapper
│   ├── ui/                     Shared UI components
│   ├── typescript-config/      Shared TypeScript configurations
│   └── eslint-config/          Shared ESLint configurations
├── infra/
│   ├── docker-compose.dev.yml  Full local stack (Postgres, Redis, services)
│   ├── docker-compose.prod.yml Production stack for EC2 deployment
│   └── docker/                 Production Dockerfiles for each microservice
├── docs/
│   ├── deployment.md           Production EC2 & CI/CD guide
│   └── local-ports.txt         Quick local port reference
├── turbo.json                  Turborepo build & task graph
└── package.json                Workspace root (apps/*, packages/*)
```

---

## Prerequisites

* [Bun](https://bun.com) `1.3.14` or newer (runtime and package manager)
* [Node.js](https://nodejs.org) `>=20`
* [Docker](https://docs.docker.com/get-docker/) & Docker Compose (for Postgres, Redis, and containerized deployment)

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/Devashish-Belwal/CryptoExchange.git
cd CryptoExchange
bun install
```

### 2. Running Locally

#### Option A: Everything in Docker

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```
Starts TimescaleDB (Postgres, port `5432`), Redis (port `6379`), and all backend services with volume bind-mounts for live reloading.

#### Option B: Infrastructure in Docker, Services on Host

1. Start database and cache:
   ```bash
   docker compose -f infra/docker-compose.dev.yml up -d db redis
   ```

2. Run Prisma migrations:
   ```bash
   cd packages/database
   bunx prisma migrate deploy
   ```

3. Run all backend services and debug console in watch mode:
   ```bash
   bun run dev
   ```
   Or run a single service: `bun run --cwd apps/core-backend dev`.

---

## Frontend (Debug Console)

The exchange includes a built-in terminal-themed debug and trading interface located at [`apps/debug-console`](apps/debug-console).

* **Development:**
  ```bash
  bun run --cwd apps/debug-console dev
  ```
  Runs at `http://localhost:3002`.
* **Production:**
  ```bash
  bun run --cwd apps/debug-console build
  bun run --cwd apps/debug-console start -- -p 3002
  ```

---

## Production Deployment (AWS EC2 & CI/CD)

The backend stack is containerized with Docker and continuously deployed to **AWS EC2** using **GitHub Actions**.

* **Docker Compose Stack:** [`infra/docker-compose.prod.yml`](infra/docker-compose.prod.yml) runs TimescaleDB, Redis, and all 6 backend microservices on an isolated Docker network.
* **CI/CD Pipeline:** [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) validates TypeScript, builds images, pushes to Docker Hub, and automatically updates the EC2 instance via SSH.
* **Reverse Proxy:** Nginx routes incoming public traffic (with Let's Encrypt SSL) to the appropriate microservices:
  * `https://api.yourdomain.com/core/` ➔ REST API (`:8080`)
  * `https://api.yourdomain.com/engine/` ➔ Matching Engine (`:8081`)
  * `https://api.yourdomain.com/database/` ➔ Database Worker (`:8082`)
  * `https://api.yourdomain.com/ws` ➔ WebSocket Stream (`:8083`)
  * `https://api.yourdomain.com/poller/` ➔ Index Poller (`:8084`)
  * `https://api.yourdomain.com/proxy/` ➔ Backpack Proxy (`:8085`)
  * `https://debug.yourdomain.com` ➔ Debug Console (`:3002`)

See [`docs/deployment.md`](docs/deployment.md) for the complete, step-by-step production setup and Nginx configuration.

---

## Workspace Scripts

```bash
bun run build       # Turborepo build across all apps & packages
bun run dev         # Turborepo watch/dev mode
bun run lint        # ESLint across all apps & packages
bun run format      # Prettier formatting
bun run typecheck   # TypeScript check across all packages
```

---

## Documentation

* [`apps/core-trading-engine/README.md`](apps/core-trading-engine/README.md) — Detailed engine architecture: matching loops, order book structures, balances, ADL, liquidation, funding settlement, and event specifications.
* [`docs/deployment.md`](docs/deployment.md) — Production EC2 deployment, Nginx configuration, SSL, and GitHub Actions setup.
* [`docs/local-ports.txt`](docs/local-ports.txt) — Port mapping reference.
