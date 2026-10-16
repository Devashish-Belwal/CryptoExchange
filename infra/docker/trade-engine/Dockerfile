FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/core-trading-engine/package.json apps/core-trading-engine/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/redis-stream/package.json packages/redis-stream/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL

RUN bun install

COPY apps/core-trading-engine apps/core-trading-engine
COPY packages/database packages/database
COPY packages/redis-stream packages/redis-stream
COPY packages/shared packages/shared
COPY packages/typescript-config packages/typescript-config

RUN cd packages/database && bunx prisma generate --schema prisma/schema.prisma

RUN bunx tsc --noEmit -p apps/core-trading-engine/tsconfig.json

FROM oven/bun:1-slim AS runtime

RUN groupadd -r cex && useradd -r -g cex -m cex

WORKDIR /app
COPY --chown=cex:cex --from=builder /app /app/

USER cex

ENV NODE_ENV=production

EXPOSE 8081

CMD ["bun", "run", "--cwd", "apps/core-trading-engine", "start"]