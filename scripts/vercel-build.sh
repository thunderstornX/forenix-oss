#!/usr/bin/env bash
# Vercel build entrypoint.
#
# Production provisions the Postgres schema + seeds the concept demo;
# preview / development builds skip that — they have no provisioned
# database (Preview's DATABASE_URL is an unreachable placeholder, set
# so `prisma generate` parses), so they just generate the client and
# build. That lets PR previews render the marketing surface without a
# live DB instead of failing at `prisma db push`.
#
# For a fully DB-backed preview, attach a real Preview database (e.g.
# the Vercel/Neon integration's per-branch databases, which inject a
# working DATABASE_URL into the Preview environment) — this script then
# needs no change, just flip the guard to run db push there too.
set -euo pipefail

prisma generate --schema=prisma/schema.postgres.prisma

if [ "${VERCEL_ENV:-}" = "production" ]; then
  prisma db push --schema=prisma/schema.postgres.prisma --accept-data-loss
  tsx scripts/seed-if-empty.ts
else
  echo "── ${VERCEL_ENV:-non-production} build: skipping db push + seed (no provisioned DB) ──"
fi

next build
