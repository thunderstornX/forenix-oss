#!/usr/bin/env bash
# forenix-oss backup — Postgres logical dump + evidence-store archive +
# service env, with local rotation and an optional off-site push.
#
# Version-controlled source of truth. On the droplet this is installed
# to /usr/local/sbin/forenix-backup.sh (out-of-tree on purpose: the
# deploy workflow rsyncs --delete into /opt/forenix, so anything under
# the deploy path would be wiped on the next deploy — this won't) and
# fired nightly by forenix-backup.timer. Self-hosters: install it the
# same way (RUNBOOK §15).
#
# Runs as root.
set -euo pipefail
shopt -s nullglob          # empty globs expand to nothing, not literal

DB="forenix_oss"
EVID="${FORENIX_EVIDENCE_DIR:-/opt/forenix/.evidence-store}"
ENV_FILE="/opt/forenix/.env"
DEST="/var/backups/forenix"
KEEP=14                                  # newest N of each artifact
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

install -d -m 700 "$DEST"

# 1. Postgres — custom-format dump (compressed, selective restore via
#    pg_restore). Write .part then atomic rename so a crash never
#    leaves a half-dump that rotation might keep.
runuser -u postgres -- pg_dump -Fc "$DB" > "$DEST/db_${STAMP}.dump.part"
mv "$DEST/db_${STAMP}.dump.part" "$DEST/db_${STAMP}.dump"

# 2. Evidence store — only when present and non-empty (file-byte custody).
if [ -d "$EVID" ] && [ -n "$(ls -A "$EVID" 2>/dev/null)" ]; then
  tar -czf "$DEST/evidence_${STAMP}.tar.gz" -C "$(dirname "$EVID")" "$(basename "$EVID")"
fi

# 3. Service env (DATABASE_URL, API keys, AUTH secrets) — crown jewels
#    for a bare-metal restore. Dir is 0700 root. NEVER push this
#    off-site unencrypted (the rclone step below excludes it).
if [ -f "$ENV_FILE" ]; then
  install -m 600 "$ENV_FILE" "$DEST/env_${STAMP}.bak"
fi

# 4. Rotate — keep the newest $KEEP of each kind. nullglob-safe: an
#    empty match yields an empty array, never a literal pattern or an
#    ls error.
rotate() {
  local files=( "$DEST"/$1 )
  (( ${#files[@]} > KEEP )) || return 0
  # sort newest-first by mtime, drop the first $KEEP, remove the rest
  ls -1t "${files[@]}" | tail -n +$((KEEP+1)) | xargs -r rm -f
}
rotate 'db_*.dump'
rotate 'evidence_*.tar.gz'
rotate 'env_*.bak'

# 5. Off-site (optional, future-ready): if an rclone remote named
#    'forenix-offsite' exists, mirror DB + evidence (NOT env). No-op
#    until someone runs `rclone config` for that remote.
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q '^forenix-offsite:'; then
  rclone copy "$DEST" forenix-offsite:forenix-backups \
    --include 'db_*.dump' --include 'evidence_*.tar.gz' --max-age 30h
fi

echo "forenix-backup ${STAMP}: db dump $(du -h "$DEST/db_${STAMP}.dump" | cut -f1) -> $DEST"
