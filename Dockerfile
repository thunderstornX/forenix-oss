# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────
# forenix-oss — production self-host image.
#
# Multi-stage:
#   1. deps       — install all deps (frozen lockfile).
#   2. builder    — generate Prisma client, build Next standalone.
#   3. runtime    — distroless-ish runtime carrying only the
#                   standalone output + the Prisma engines.
#
# Build:    docker build -t forenix-oss:latest .
# Run:      docker run -p 3000:3000 --env-file .env forenix-oss:latest
#
# Pair with docker-compose.yml for a one-command Postgres + app
# deployment.
# ─────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20.19.6
ARG BUN_VERSION=1.3.6

# ── stage 1: deps ────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── stage 2: builder ────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use the Postgres-flavoured schema for the build so the production
# image ships with the right Prisma client.
RUN bunx prisma generate --schema=prisma/schema.postgres.prisma

# next build emits a standalone server under .next/standalone
RUN bun run build

# ── stage 3: runtime ────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# OpenSSL needed by Prisma engines on Debian slim.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Non-root user.
RUN groupadd --system --gid 1001 forenix \
 && useradd  --system --uid 1001 --gid 1001 --shell /bin/false forenix

# Copy the standalone build + public + .next/static + Prisma engines.
COPY --from=builder --chown=forenix:forenix /app/.next/standalone ./
COPY --from=builder --chown=forenix:forenix /app/.next/static ./.next/static
COPY --from=builder --chown=forenix:forenix /app/public ./public
COPY --from=builder --chown=forenix:forenix /app/prisma ./prisma
COPY --from=builder --chown=forenix:forenix /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=forenix:forenix /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER forenix
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/auth/csrf').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
