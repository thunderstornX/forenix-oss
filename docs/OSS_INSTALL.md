# Installing forenix-oss (self-host)

This is the unified entry-point for running forenix-oss on your own
hardware. Three install paths, ordered by how much you want to do
yourself:

1. **Docker Compose** - one command, app + Postgres, good for trials
2. **VPS production** - systemd + Caddy + the deep OSS toolchain,
   what runs at [`demo.forenix.tech`](https://demo.forenix.tech)
3. **Local dev** - bare metal, fastest iteration loop

For the SaaS premium tier see [`SAAS.md`](SAAS.md). For the Vercel
demo deployment see [`VERCEL_DEPLOY.md`](VERCEL_DEPLOY.md).

---

## What you get

Every analyst feature in the product:

- Real Git per case (isomorphic-git)
- SHA-256 forward-chained audit log
- External attestation backends (local HMAC, GitHub witness, Sigstore
  Rekor)
- LLM-orchestrated OSINT pipeline with 20 OSS tools
- Scheduled monitors + scheduled attestations
- Merge-request reviews on evidence branches
- Teams + RBAC inside a single workspace
- Six AI adapters (mock, Ollama, GLM, OpenRouter, NVIDIA, Groq)

What you do not get (paid tier, see [`SAAS.md`](SAAS.md)):

- ClaudeAdapter (Anthropic key + `SAAS_MODE=true`)
- Multi-tenant org isolation
- PDF report export
- Advanced OSINT adapters (Shodan / Censys / Hunter / HIBP at metered
  cadence)
- SSO

---

## Path A. Docker Compose (5 minutes)

The fastest evaluation path. Brings up Postgres + the app together.

```bash
git clone https://github.com/thunderstornX/forenix-oss.git
cd forenix-oss

# Generate an auth secret
echo "AUTH_SECRET=$(openssl rand -base64 32)" > .env

# Pull, build, and start
docker compose up -d --build

# One-time DB bootstrap
docker compose exec app bunx prisma db push \
  --schema=prisma/schema.postgres.prisma
docker compose exec app bun run db:seed:pg

# Visit
open http://localhost:3000
```

Default seeded login: `admin@forenix-oss.local` / `forenix`.

The compose file is at the repo root; review it before exposing the
app to anything other than localhost.

---

## Path B. VPS production (DigitalOcean, etc.)

The same recipe that runs the paid SaaS at
[demo.forenix.tech](https://demo.forenix.tech) (invite-only,
provisioned from the waitlist on forenix.tech). systemd unit + Caddy
front + the deep OSS toolchain installed onto the host. If you
self-host this way, you are running the same build as the SaaS, just
without the multi-tenant + billing pieces (which haven't shipped yet
either, see [`SAAS.md`](SAAS.md)).

This path is documented in detail at
[`SELF_HOST.md`](SELF_HOST.md). The short version:

```bash
# 1. Provision a VM (Ubuntu 24.04 LTS, 4 GB RAM minimum)
# 2. Install Node 22, Bun, Postgres (or use managed Postgres)
# 3. Install the OSS toolchain (Python venv + Go binaries + nuclei
#    templates) per SELF_HOST.md §2
# 4. Clone, configure, build:
git clone https://github.com/thunderstornX/forenix-oss.git
cd forenix-oss
cp .env.example .env  # fill in DATABASE_URL, AUTH_SECRET, AI_ADAPTER
bun install
bun run db:push:pg
bun run db:seed:pg
bun run build
# 5. Drop the systemd unit at /etc/systemd/system/forenix.service
#    per SELF_HOST.md §4
sudo systemctl enable --now forenix.service
# 6. Front with Caddy for HTTPS per SELF_HOST.md §5
```

The deep toolchain (subfinder, httpx, dnsx, amass, nuclei, sherlock,
theHarvester, holehe, exiftool, gowitness, yt-dlp, tesseract) only
exists on real hardware - the Vercel surface skips them and uses
HTTP-only collectors as a fallback.

For ops once it is running (daily checks, incident response, key
rotation, monitor + attestation schedules) see
[`09-RUNBOOK.md`](09-RUNBOOK.md).

---

## Path C. Local dev

```bash
git clone https://github.com/thunderstornX/forenix-oss.git
cd forenix-oss
bun install
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env  # plus DATABASE_URL=file:./dev.db
bun run db:push
bun run db:seed
bun run dev
# open http://localhost:3000
```

Default seeded login: `admin@forenix-oss.local` / `forenix`.

This uses SQLite under the hood (`prisma/dev.db`). To match
production, point `DATABASE_URL` at a local Postgres and use the
`db:*:pg` scripts instead.

---

## Environment variables you actually need

The OSS lane needs three:

```bash
DATABASE_URL=postgresql://...        # or file:./dev.db for SQLite
AUTH_SECRET=<openssl rand -base64 32>
AI_ADAPTER=mock                       # or ollama / glm / openrouter / nvidia / groq
```

Everything else in `.env.example` is for specific adapters (their API
keys) or for cron-driven monitors (`CRON_SECRET`,
`MONITOR_CRON_TOKEN`) or for the SaaS tier (`SAAS_MODE`,
`ANTHROPIC_API_KEY`). Skip the lines you do not use.

---

## Connecting a real LLM (OSS-compatible adapters)

Pick one of these and set `AI_ADAPTER` to its name. All are free or
have a free tier; none require `SAAS_MODE`.

| Adapter | Cost | Notes |
|---|---|---|
| `mock` | free | Deterministic seeded JSON. Zero infra. The default. |
| `groq` | free (no card) | Fastest. ~150 ms median. Sign up at [console.groq.com](https://console.groq.com). |
| `openrouter` | free + paid tiers | One key, many models. [openrouter.ai](https://openrouter.ai). |
| `nvidia` | free dev tier | Hosted NIM. [build.nvidia.com](https://build.nvidia.com). |
| `glm` | free tier | Zhipu AI GLM-4 / 5. [open.bigmodel.cn](https://open.bigmodel.cn). |
| `ollama` | free | Local. Heaviest infra (you run it). [ollama.com](https://ollama.com). |

Configure the matching block in `.env` (see `.env.example`).

---

## Scheduled monitors + attestations

When you want monitors or attestations to fire on a cadence (not just
on demand), pick a cron driver. The product supports three:

1. **systemd timer on your VM** (what the live demo uses) -
   `RUNBOOK §11 / §12`
2. **GitHub Actions workflow** - `.github/workflows/cron-tick.yml`
3. **Vercel cron** - if you deploy the Vercel surface too,
   `vercel.json` carries the entries

You only need one. They are designed to be idempotent - running two
in parallel is a no-op for any row already locked.

---

## Updating

```bash
cd forenix-oss
git pull
bun install                              # bun.lock will catch up
bunx prisma db push --schema=prisma/schema.postgres.prisma
bun run build
sudo systemctl restart forenix.service   # or docker compose up -d
```

Breaking schema changes (rare) are called out in `CHANGELOG.md` under
the relevant `Unreleased` or release heading.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Empty dashboard, no seed data | `db:seed` was skipped | `bun run db:seed` (or `db:seed:pg`) |
| Pipeline returns "no adapter" | `AI_ADAPTER` unset or invalid | Set to `mock` if unsure |
| OSINT tool runs but returns nothing | The binary is missing from $PATH | Walk through `SELF_HOST.md §2` |
| Audit chain breaks | A row was edited outside the API | `RUNBOOK §3` walks through the recovery |
| Vercel deploys but cron rejects | Hobby tier rejects sub-daily schedules | Move 5-min cadence to GitHub Actions per `RUNBOOK §11` |

For anything else, the repo accepts issues at
[github.com/thunderstornX/forenix-oss/issues](https://github.com/thunderstornX/forenix-oss/issues).
