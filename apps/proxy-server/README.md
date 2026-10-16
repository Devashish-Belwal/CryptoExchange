# proxy-server

A small, dependency-free reverse proxy that fronts a public third-party exchange API
(Backpack) so the frontends can pull reference market data without exposing that upstream
directly or fighting its CORS policy. It doesn't touch `core-trading-engine`, Postgres or Redis
at all — it's a pure HTTP-to-HTTP gateway.

## What it does

- Proxies `GET/HEAD/OPTIONS` under `/api/backpack/*` to `BACKPACK_REST_URL` (default
  `https://api.backpack.exchange`), rewriting the path prefix away
- Blocks mutating methods (`POST`/`PUT`/`PATCH`/`DELETE`) unless `ALLOW_MUTATIONS=true` is set
  explicitly
- Adds `helmet` security headers, `compression`, request logging and a per-IP rate limiter
  (`RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`) in front of the proxied routes
- Locks down CORS to `ALLOWED_ORIGINS`

## Port & health checks

| | |
|---|---|
| Port | `8085` (env `PORT`) |
| Liveness | `GET /alive` — 200 once the process is up |
| Readiness | `GET /ready` — 200 only if the upstream (`BACKPACK_REST_URL/api/v1/ping`) responds within 3s; 503 otherwise |

```bash
curl http://localhost:8085/alive
curl http://localhost:8085/ready
```

## Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `8085`) |
| `BACKPACK_REST_URL` | Upstream REST API this proxy forwards to |
| `ALLOWED_ORIGINS` | Comma-separated list of frontend origins allowed through CORS |
| `ALLOW_MUTATIONS` | If `true`, forwards non-safe HTTP methods too (default `false`, read-only proxy) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Per-IP rate limit applied to `/api/backpack/*` |

## Scripts

```bash
bun run dev     # bun --watch, restarts on file change
bun run start   # bun src/index.ts
bun run build   # tsc -> dist/
bun run test    # jest --detectOpenHandles
bun run lint    # tsc --noEmit + eslint
```

## Depends on

- Nothing internal — no database, Redis or trading-engine dependency. Only an outbound
  connection to `BACKPACK_REST_URL`.

Run the whole stack together with `docker compose -f infra/docker-compose.dev.yml up -d`
from the repo root, or see the [root README](../../README.md) for local setup without Docker.
