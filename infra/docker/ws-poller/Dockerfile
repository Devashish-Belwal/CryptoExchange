FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/ws-index-poller/package.json apps/ws-index-poller/package.json
COPY packages/redis-stream/package.json packages/redis-stream/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN bun install

COPY apps/ws-index-poller apps/ws-index-poller
COPY packages/redis-stream packages/redis-stream
COPY packages/shared packages/shared
COPY packages/typescript-config packages/typescript-config

RUN bunx tsc --noEmit -p apps/ws-index-poller/tsconfig.json

FROM oven/bun:1-slim AS runtime

RUN groupadd -r cex && useradd -r -g cex -m cex

WORKDIR /app
COPY --chown=cex:cex --from=builder /app /app/

USER cex

ENV NODE_ENV=production

EXPOSE 8084

CMD ["bun", "run", "--cwd", "apps/ws-index-poller", "start"]