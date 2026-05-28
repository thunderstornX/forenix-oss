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

# Make `bun` available even when this script is invoked from a
# non-interactive shell (GitHub Actions SSH session) where
# ~/.bashrc isn't sourced. The standard bun installer places the
# binary at ~/.bun/bin/bun.
export PATH="$HOME/.bun/bin:$PATH"

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

echo "── pre-push DB snapshot ──"
# Capture a fresh dump right before any schema change touches the live
# DB — an immediate restore point that doesn't wait for the nightly
# timer. Reuses the same backup script the systemd timer runs; needs a
# sudoers line on the droplet:
#   forenix ALL=(root) NOPASSWD: /usr/local/sbin/forenix-backup.sh
if [ -x /usr/local/sbin/forenix-backup.sh ]; then
  sudo -n /usr/local/sbin/forenix-backup.sh \
    || echo "::warning:: pre-push snapshot skipped (nightly backup still covers you)"
else
  echo "::warning:: /usr/local/sbin/forenix-backup.sh not installed — skipping pre-push snapshot"
fi

echo "── prisma db push (postgres) ──"
# NB: --accept-data-loss is intentionally NOT passed in the auto-deploy
# path. Without it, a destructive schema change (dropping a column or
# table) ABORTS the deploy instead of silently running against
# customer data. The build has already succeeded and the service is
# still on the previous version, so prod stays up. To apply a
# deliberate destructive migration, an operator confirms the snapshot
# above, then runs it by hand:
#   bunx prisma db push --schema=prisma/schema.postgres.prisma --accept-data-loss
bunx prisma db push --schema=prisma/schema.postgres.prisma

echo "── next build ──"
bun run build

echo "── systemctl restart forenix.service ──"
# Sudoers entry required on the droplet:
#   forenix ALL=(root) NOPASSWD: /bin/systemctl restart forenix.service
sudo /bin/systemctl restart forenix.service

# Report the deployed revision from the .revision file the workflow
# stamped into the rsynced tree — NOT from the on-droplet .git, which
# is a vestigial, deploy-excluded repo whose HEAD froze at first setup
# and would report a wrong SHA.
if [ -f "${PWD_HERE}/.revision" ]; then
  echo "✓ deploy complete ($(cat "${PWD_HERE}/.revision"))"
else
  echo "✓ deploy complete (no .revision stamped)"
fi
