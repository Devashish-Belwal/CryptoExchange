FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/ws-server/package.json apps/ws-server/package.json
COPY packages/redis-stream/package.json packages/redis-stream/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN bun install

COPY apps/ws-server apps/ws-server
COPY packages/redis-stream packages/redis-stream
COPY packages/shared packages/shared
COPY packages/typescript-config packages/typescript-config

RUN bunx tsc --noEmit -p apps/ws-server/tsconfig.json

FROM oven/bun:1-slim AS runtime

RUN groupadd -r cex && useradd -r -g cex -m cex

WORKDIR /app
COPY --chown=cex:cex --from=builder /app /app

USER cex

ENV NODE_ENV=production

EXPOSE 8083

CMD ["bun", "run", "--cwd", "apps/ws-server", "start"]