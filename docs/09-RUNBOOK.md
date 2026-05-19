# Operational Runbook  -  forenix-oss

The day-2 ops book. What to do when something breaks, and what to
check on a routine cadence.

## 1. Daily checks (5 min)

```bash
curl -s $BASE/api/health
curl -s $BASE/api/audit/verify | jq '.data'
```

Both should return immediately with `ok:true`. If verify is
`ok:false`, jump to §3.

## 2. Weekly checks (15 min)

- Snapshot the database (Postgres: `pg_dump --format=c`; SQLite:
  the `.backup` SQL command).
- Tail the dev log for `unhandledRejection` / `5xx` patterns.
- Confirm the active `AI_ADAPTER` is what you expect.
- Confirm sealed evidence count has not decreased: a decrease
  means someone unsealed (which the API forbids) or a manual
  database edit happened  -  both demand investigation.

## 3. Incident: audit chain broken

**Symptom:** `GET /api/audit/verify` returns `ok:false`.

**Triage.**

1. Note the `brokenAt` id and timestamp.
2. Pull the row before + the row at `brokenAt`:
   ```sql
   SELECT id, action, entity, "entityId", hash, "prevHash", "createdAt"
   FROM "AuditLog"
   WHERE "createdAt" <= (SELECT "createdAt" FROM "AuditLog" WHERE id = '<brokenAt>')
   ORDER BY "createdAt" DESC
   LIMIT 5;
   ```
3. Is the `brokenAt` row's `prevHash` equal to the previous row's
   `hash`?
   - If **no** -> a row was inserted/edited/deleted out of band.
   - If **yes** -> the row's own `hash` was corrupted.
4. **Do not** try to "fix" the chain by recomputing. The integrity
   guarantee is exactly that this is impossible to fix invisibly.
5. Escalate per your incident-response policy. The chain remains
   broken until the next legitimate write  -  at that point, the
   `brokenAt` row's prevHash is no longer the "tip" of the chain,
   but it remains visible to all future verifies.

## 4. Incident: pipeline run hangs / times out

**Symptom:** `POST /api/pipeline/run/:id` returns a 500 after 90 s.

**Triage.**

1. Check the dev log for the actual exception (it's usually the
   AbortController firing on a slow LLM).
2. Confirm the active adapter is reachable:
   ```bash
   # NVIDIA
   curl -s -X POST https://integrate.api.nvidia.com/v1/chat/completions \
     -H "authorization: Bearer $NVIDIA_API_KEY" \
     -H "content-type: application/json" \
     -d '{"model":"meta/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}],"max_tokens":4}'
   ```
3. If the provider is healthy but slow, drop the agent-group count
   for the run, or switch model:
   ```bash
   AI_ADAPTER=openrouter OPENROUTER_MODEL=openai/gpt-oss-120b:free bun run dev
   ```
4. The Investigation will be stuck in `running`  -  set it back to
   `draft` with a one-off Prisma update if necessary. Note that
   this write *also* gets audited.

## 5. Incident: adapter returns invalid JSON

**Symptom:** `extractJson` throws during a pipeline run.

**Triage.**

1. The dev log contains the raw model response  -  copy it.
2. Re-test the model directly (curl above) to confirm it routinely
   returns non-JSON when asked for JSON.
3. Either:
   - Switch model (`OPENROUTER_MODEL=...`).
   - Tighten the prompt in `src/lib/ai/chat-completions.ts`
     (`SYSTEM_PIPELINE`, `SYSTEM_ENTITIES`).
4. The current `extractJson` already handles ```json fences and
   prose preambles; failures usually mean the model is genuinely
   off-spec.

## 6. Routine  -  re-seed the demo

```bash
bun run db:seed
```

This wipes every row using Prisma `deleteMany` (no `--force-reset`
so it bypasses the Prisma agent guard) and re-seeds to a clean
baseline with 9 audit rows.

## 7. Routine  -  capture fresh screenshots

```bash
bun run dev                  # in one terminal
bun run db:seed              # in another
HOST=http://localhost:3000 bun run scripts/manual_screenshots.mjs
```

Output lands in `docs/manual_screenshots/`. The script signs in
as the seeded admin automatically  -  no manual auth needed.

## 8. Routine  -  rotate an LLM key

1. Generate a new key in the provider's console.
2. Edit `.env` (do **not** commit).
3. Restart dev (`Ctrl+C` then `bun run dev`).
4. `GET /api/health` should still report the same adapter name.
5. `POST /api/pipeline/run/:id` with a 1-finding agent-group set
   to confirm the new key works.

## 9. Routine  -  upgrade Node / Bun / Prisma

```bash
bun upgrade                  # bun runtime
bun update                   # project deps
bunx prisma generate         # regenerate the client
bun run typecheck            # confirm
bun run lint                 # confirm
bun run db:seed              # confirm
```

If anything fails, the upgrade is the suspect  -  pin back and file
an issue.

## 10. Emergency stop

```bash
pkill -9 -f 'next dev|next-server'
```

Wait 2 s, confirm with `pgrep -f next` (no output = clean stop).
The database is unaffected; restarting `bun run dev` resumes.

## 11. Routine  -  scheduled monitors

Monitors fire on a cadence string (`hourly` / `daily` / `weekly` /
`monthly`, or `every:N(m|h|d)` — see `src/lib/monitor-scheduler/cadence.ts`
for the grammar). The scheduler is **one entry point with three cron
drivers**; same code path covers all three:

| Driver | Where it runs | Cadence | Token env |
|---|---|---|---|
| `vercel.json` `crons` block | Vercel platform | **daily** (Hobby tier limit: 1/day max) | `CRON_SECRET` (Vercel project env) |
| `.github/workflows/monitor-tick.yml` | GitHub Actions | every 5 min | `CRON_SECRET` + `MONITOR_CRON_TOKEN` (repo Actions secrets) |
| systemd timer | DigitalOcean Droplet (or any self-host) | every 5 min | `MONITOR_CRON_TOKEN` (in `/opt/forenix/.env`) |

All three POST `/api/internal/monitor-tick`. The route accepts either
token env, with or without the `Bearer ` prefix, so no per-driver
code change is needed.

**Why three?** Vercel Hobby caps cron jobs at one-per-day; we keep
the daily entry so the platform doesn't reject the deploy, and run
GitHub Actions as the actual production cadence for the Vercel
surface (free for public repos, 5-min minimum). The Droplet's
systemd timer is independent — when self-hosting, that's the only
driver you need.

### Set up GitHub Actions (the 5-min cadence for the Vercel surface)

1. Repo Settings → Secrets and variables → Actions → New repository secret:
   - `CRON_SECRET` = same value as the Vercel project env
   - `MONITOR_CRON_TOKEN` = same value as `/opt/forenix/.env` on the Droplet
2. (Optional) override the target URLs as repo *variables* if the
   demos move:
   - `VERCEL_MONITOR_URL`  = e.g. `https://forenix.tech/api/internal/monitor-tick`
   - `DROPLET_MONITOR_URL` = e.g. `https://demo.forenix.tech/api/internal/monitor-tick`
3. The workflow at `.github/workflows/monitor-tick.yml` fires every
   5 min. Inspect runs at Actions → monitor-tick. Manually fire
   with the "Run workflow" button for ad-hoc kicks.

### Set up the Droplet timer

```bash
ssh root@206.189.82.103

# 1. Pick a secret + add it to /opt/forenix/.env
echo "MONITOR_CRON_TOKEN=$(openssl rand -hex 32)" >> /opt/forenix/.env
systemctl restart forenix

# 2. Drop the service + timer.
cat >/etc/systemd/system/forenix-monitor-tick.service <<UNIT
[Unit]
Description=forenix-oss monitor scheduler tick
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/opt/forenix/.env
ExecStart=/usr/bin/curl -fsS -X POST \\
  -H "Authorization: \$MONITOR_CRON_TOKEN" \\
  http://localhost:3000/api/internal/monitor-tick
UNIT

cat >/etc/systemd/system/forenix-monitor-tick.timer <<TIMER
[Unit]
Description=Run forenix-oss monitor scheduler every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=forenix-monitor-tick.service
[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now forenix-monitor-tick.timer
systemctl list-timers | grep forenix-monitor-tick   # confirm it's queued
```

### Operator actions in the UI

- **New monitor** — header action on the Monitors view. Picks a
  target + targetType + cadence + (optionally) an investigation to
  link. First tick fires within ~30 s so you see a result quickly.
- **Run now** — per-card button. Bypasses the next scheduled tick.
  Useful for verifying a freshly-created monitor or chasing a
  suspected change without waiting up to 5 min.
- **Pause / Resume** — per-card toggle. Pausing nulls `nextRunAt`
  so the scheduler skips the row; resuming recomputes `nextRunAt`
  from the last run + the cadence.
- **Change cadence** — per-card select. The next tick is recomputed
  immediately; if the new cadence would have already fired, it's
  pushed out by 30 s instead of firing instantly.
- **Delete** — per-card. Audit-logged.

### Debugging

```bash
# Tail the tick endpoint locally:
curl -X POST http://localhost:3000/api/internal/monitor-tick \
  -H "Authorization: Bearer <MONITOR_CRON_TOKEN>" | jq

# On the Droplet, check the timer + the last few service runs:
ssh root@206.189.82.103 'systemctl list-timers | grep monitor; journalctl -u forenix-monitor-tick.service -n 20 --no-pager'

# Find rows that should be firing but aren't:
sudo -u postgres psql forenix_oss -c "
  SELECT id, target, status, \"nextRunAt\"
  FROM \"Monitor\"
  WHERE status='active' AND (\"nextRunAt\" IS NULL OR \"nextRunAt\" < now())
  ORDER BY \"nextRunAt\" ASC;"
```

## 12. Routine  -  scheduled attestations

Cron-triggered attestations close the strongest gap in the
chain-of-custody story: "did someone remember to click Attest now?"
becomes "the chain witnesses itself automatically and the witness
history is itself audited."

Reuses the Monitor scheduler's cron infrastructure (same three
drivers, same token, same cadence grammar). Adds:

- `AttestationSchedule` Prisma model  -  one row per backend you
  want fired on a schedule.
- `POST /api/internal/attest-tick`  -  the cron-driver endpoint.
- `GET / POST /api/admin/attestation-schedule`  -  list / create
  (admin only).
- `PATCH / DELETE /api/admin/attestation-schedule/[id]`  -
  pause/resume, change cadence, delete (admin only).
- A schedules panel in the Integrity dashboard (admin only).

### Cadence

Same grammar as monitors (`hourly` / `daily` / `weekly` /
`monthly` / `every:N(m|h|d)`). A typical setup pairs:

  - `local`  cadence=hourly      (cheap; catches accidental disk corruption fast)
  - `github` cadence=daily       (publicly-witnessed; comment edit-history detects tampering)
  - `rekor`  cadence=weekly      (Sigstore transparency log; the strongest witness)

### Cron drivers

The three drivers from ยง11 (`vercel.json` daily + GitHub Actions
every 5min + Droplet systemd timer) all also fire the attest tick;
no extra setup beyond setting the secrets is required. The Vercel
daily cron is a backstop; GitHub Actions is the actual cadence on
the Vercel surface. The `cron-tick.yml` workflow has a separate
`attest` job so a slow Rekor anchor doesn't delay the next monitor
tick.

### Operator setup

```bash
# 1. As an admin, hit Integrity in the app:
#    > Scheduled attestations panel
#    > "New schedule" -> pick backend + cadence
#
# 2. First fire arrives within ~30s of creation; subsequent fires
#    are at the chosen cadence.
#
# 3. Inspect runs at:
#    - Vercel:  Vercel project -> Crons tab; or curl the live tick
#      with the same shared secret
#    - Actions: github.com/.../actions/workflows/monitor-tick.yml
#    - Droplet: journalctl -u forenix-monitor-tick.service -n 30
```


## 13. Routine  -  SaaS auto-deploy (DigitalOcean)

The paid SaaS at [demo.forenix.tech](https://demo.forenix.tech)
auto-deploys on every push to `main` via the GitHub Actions
workflow at `.github/workflows/deploy-droplet.yml`. The workflow
checks out OSS Core + the private SaaS overlay
(github.com/thunderstornX/forenix-saas), assembles them, rsyncs
onto the droplet, then runs `scripts/deploy-droplet.sh` to install,
build, and restart the systemd service.

### One-time setup

**Repo secrets** (forenix-oss → Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `SAAS_REPO_TOKEN` | Fine-grained PAT with READ access to `thunderstornX/forenix-saas`. Scope: Repository contents → Read-only |
| `DROPLET_HOST` | IP or DNS of the droplet (e.g. `demo.forenix.tech`) |
| `DROPLET_USER` | Deploy user on the droplet (typically `forenix`) |
| `DROPLET_SSH_KEY` | Private SSH key (PEM, including headers) whose public side is in the deploy user's `~/.ssh/authorized_keys` |
| `DROPLET_DEPLOY_PATH` | Repo path on the droplet (typically `/opt/forenix`) |

**On the droplet:**

```bash
# Sudoers entry — the deploy user needs to restart the service.
sudo tee /etc/sudoers.d/forenix-deploy <<'SUDO'
forenix ALL=(root) NOPASSWD: /bin/systemctl restart forenix.service
SUDO
sudo chmod 0440 /etc/sudoers.d/forenix-deploy

# Add the GH Actions runner's SSH public key to the deploy user.
# (Whatever you put in DROPLET_SSH_KEY, append its .pub here.)
sudo -u forenix tee -a /home/forenix/.ssh/authorized_keys < gh-actions.pub
```

### Manual trigger

The workflow has `workflow_dispatch`, so you can trigger an ad-hoc
deploy from the Actions tab without pushing:

```
GitHub → Actions → "Deploy SaaS (DigitalOcean)" → Run workflow
```

### Smoke check

The workflow polls `https://demo.forenix.tech/api/health` for up to
~15 s after restart and fails if it doesn't return 200. If the
deploy reports "✓" but the smoke check fails, the build is on the
droplet but the service didn't come back; see `journalctl -u
forenix.service -n 100` on the droplet.

### Updating the overlay

When you make changes in `thunderstornX/forenix-saas` (the private
overlay) without a corresponding OSS change, the public repo's
auto-deploy won't fire. Two options:

```bash
# Option A (recommended): land an empty commit on OSS main to retrigger
cd forenix-oss && git commit --allow-empty -m "chore: redeploy for overlay change v0.4.0+saasN" && git push

# Option B: manual workflow_dispatch from the Actions tab
```


## 14. Routine  -  Cross-deployment waitlist sync

Both forenix.tech (Vercel concept) and demo.forenix.tech (paid
SaaS on DO) host the same `POST /api/waitlist` endpoint. To keep
ALL signups in the DO database (so admins have one canonical view),
the Vercel surface forwards every signup to the DO surface's
`POST /api/admin/waitlist-import`.

### Wiring (one-time)

**Generate the shared secret:**

```bash
openssl rand -hex 32
# copy the output  -  call it $TOKEN below
```

**On the DO droplet** (`/opt/forenix/.env`):

```
WAITLIST_SYNC_TOKEN=<TOKEN>
```

DO does NOT set `WAITLIST_SYNC_URL`  -  it is the receiver, not a
forwarder.

**On Vercel** (project Settings → Environment Variables, Production):

```
WAITLIST_SYNC_URL=https://demo.forenix.tech/api/admin/waitlist-import
WAITLIST_SYNC_TOKEN=<TOKEN>          # same value as on DO
WAITLIST_SYNC_ORIGIN=vercel-forenix-tech
```

Redeploy both surfaces so the env takes effect.

### One-time backfill

After wiring is live, push every existing Vercel row into DO:

```bash
# From a machine with Vercel's DATABASE_URL (vercel env pull .env first):
WAITLIST_SYNC_URL=https://demo.forenix.tech/api/admin/waitlist-import \
WAITLIST_SYNC_TOKEN=<TOKEN> \
WAITLIST_SYNC_ORIGIN=vercel-forenix-tech-backfill \
bun scripts/sync-waitlist-once.ts
```

Idempotent. The receiver upserts by email, so re-running just
returns "exists" for rows already present.

### Verifying it works

After a fresh signup on forenix.tech, the row should appear
within a few seconds in:

```bash
# On the droplet:
sudo -u forenix psql -U forenix -d forenix -c \
  "SELECT email, source, createdAt FROM \"WaitlistSignup\" ORDER BY createdAt DESC LIMIT 5;"
```

The `source` column reads `<original>+vercel-forenix-tech` (or
similar) for synced rows, distinguishing them from native DO
signups.

### Failure modes

The sync is fire-and-forget on the Vercel side; if the upstream is
down, the user's signup still succeeds locally on Vercel, and the
row will be picked up by the next backfill run. The Vercel
function logs `[waitlist sync] failed: …` on errors so you can
spot a sustained outage.
