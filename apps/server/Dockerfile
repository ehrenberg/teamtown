# syntax=docker/dockerfile:1
# TeamTown server image. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t teamtown-server .
# Configuration comes from environment variables (see .env.example).

FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable

# Dependencies first, so source changes don't invalidate the download layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch

COPY . .
# Install scripts are not needed to build the server (and the git hooks installer can't run here).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --offline --ignore-scripts --filter @teamtown/server...
RUN pnpm --filter @teamtown/server build \
 && pnpm --filter @teamtown/server deploy --prod --ignore-scripts /out

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/server/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# OpenTelemetry starts before the app (ADR-0030); it stays off unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
CMD ["node", "--enable-source-maps", "--import", "./dist/instrumentation.js", "dist/main.js"]
