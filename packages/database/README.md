# @workspace/database

The Prisma schema and Postgres client shared by every backend service. This package owns the
schema (`prisma/schema.prisma`) and migrations; it does not run any server itself.

## What's in here

- `prisma/schema.prisma` — models for `User`, `Session`, `Market`, `Asset`, `Balance`,
  `BalanceTransaction`, `Order`, `Trade`, `TradeTick`, `Position`, `Liquidation`, `Fund`
- `prisma/migrations/` — the full migration history
- `prisma/refresh-continuous-aggregates.sql` + `scripts/refresh-klines.ts` — TimescaleDB
  continuous aggregates backing the klines/candlestick endpoints
- `src/client.ts` — exports a singleton `PrismaClient` (via `@prisma/adapter-pg`) as `prisma`

## Who uses it

- `core-backend` — reads (users, markets, assets, history/klines queries)
- `database-engine` — the only writer; persists every engine update here
- `core-trading-engine` — read-only, at boot only (bootstraps markets/assets from Postgres if
  no snapshot exists in R2)

## Usage

```ts
import { prisma } from "@workspace/database";

const markets = await prisma.market.findMany({ where: { isActive: true } });
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql://postgres:postgres@localhost:5432/cex` |

Postgres runs as `timescale/timescaledb:latest-pg16` in `infra/docker-compose.dev.yml` (port
`5432`) — TimescaleDB is required, not just plain Postgres, because of the continuous
aggregates used for klines.

## Scripts

```bash
bunx prisma migrate dev      # create/apply a migration during local development
bunx prisma generate         # regenerate the Prisma client into src/generated/ (gitignored)
bun run refresh:klines       # bun scripts/refresh-klines.ts - manually refresh the continuous aggregates
```
