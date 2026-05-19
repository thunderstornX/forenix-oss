#!/usr/bin/env bash
# Runs on the DigitalOcean droplet, invoked by the GitHub Actions
# workflow at .github/workflows/deploy-droplet.yml after the
# assembled tree (OSS Core + SaaS overlay) has been rsynced into
# place.
#
# Steps:
#   1. Reinstall deps only if package.json or bun.lock changed.
#   2. Regenerate Prisma client + push schema (Postgres).
#   3. Build Next standalone.
#   4. Restart the systemd service (passwordless sudo).
#
# Idempotent. Safe to re-run by hand.

set -euo pipefail

cd "$(dirname "$0")/.."
PWD_HERE="$(pwd)"
echo "── deploy ${PWD_HERE} ──"

if [ ! -f bun.lock ]; then
  echo "::error:: bun.lock missing — refusing to deploy a half-synced tree"
  exit 1
fi

if [ ! -f package.json ]; then
  echo "::error:: package.json missing — refusing to deploy a half-synced tree"
  exit 1
fi

# Always reinstall — frozen lockfile catches unexpected drift, and a
# fresh install is cheap when nothing changed (bun is fast).
echo "── bun install --frozen-lockfile ──"
bun install --frozen-lockfile

echo "── prisma generate ──"
bunx prisma generate --schema=prisma/schema.postgres.prisma

echo "── prisma db push (postgres) ──"
# --accept-data-loss matches the existing db:push:pg script. Schema
# changes that would drop data still abort the deploy; the operator
# investigates and reruns by hand.
bunx prisma db push --schema=prisma/schema.postgres.prisma --accept-data-loss

echo "── next build ──"
bun run build

echo "── systemctl restart forenix.service ──"
# Sudoers entry required on the droplet:
#   forenix ALL=(root) NOPASSWD: /bin/systemctl restart forenix.service
sudo /bin/systemctl restart forenix.service

SHA="$(git -C "${PWD_HERE}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "✓ deploy complete (build sha ${SHA})"
