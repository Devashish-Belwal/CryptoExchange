FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/proxy-server/package.json apps/proxy-server/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN bun install

COPY apps/proxy-server apps/proxy-server
COPY packages/typescript-config packages/typescript-config

RUN bunx tsc --noEmit -p apps/proxy-server/tsconfig.json

FROM oven/bun:1-slim AS runtime

RUN groupadd -r cex && useradd -r -g cex -m cex

WORKDIR /app
COPY --chown=cex:cex --from=builder /app /app

USER cex

ENV NODE_ENV=production

EXPOSE 8085

CMD ["bun", "run", "--cwd", "apps/proxy-server", "start"]