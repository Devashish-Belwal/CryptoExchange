# @workspace/redis-streams

A thin wrapper around `node-redis`'s Streams API. This is the only way any service in the
monorepo talks to Redis — nobody reaches for the raw `redis` client directly.

## What's in here

- `client.ts` — `RedisManager`, a singleton connection manager. `RedisManager.getInstance()`
  returns the shared command connection; `RedisManager.createBlockingConnection(name)` opens a
  dedicated connection for a blocking `XREADGROUP` consumer loop (blocking reads can't share a
  connection with regular commands)
- `streams.ts` — `initializeRedisStreams()`, which creates the three consumer groups the system
  needs if they don't already exist:
  - `engine.request` -> `trade-engine-group`
  - `engine.response` -> `database-engine-group`
  - `engine.response` -> `ws-server-group`
- `publisher.ts` — `XADD` helpers for publishing onto a stream
- `consumer.ts` — `XREADGROUP` helpers for consumer-group reads, with pending-entry handling

## Streams at a glance

```
core-backend ─┐
              ├─▶ engine.request  ─▶ core-trading-engine
ws-index-poller ┘

core-trading-engine ─▶ engine.response ─┬─▶ database-engine (group: database-engine-group)
                                         └─▶ ws-server        (group: ws-server-group)
```

## Usage

```ts
import { RedisManager, initializeRedisStreams } from "@workspace/redis-streams";

await initializeRedisStreams(); // idempotent - safe to call on every boot
const redis = await RedisManager.getInstance();
```

## Environment variables

| Variable | Purpose |
|---|---|
| `REDIS_HOST` | Redis host (default `localhost`) |
| `REDIS_PORT` | Redis port (default `6379`) |
| `REDIS_PASSWORD` | Redis password, if set |

Redis runs as `redis:7.4-alpine` in `infra/docker-compose.dev.yml` (port `6379`).
