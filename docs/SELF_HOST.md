# Self-hosting forenix-oss

This guide assumes you control a real Linux host with persistent disk
and the ability to install OS packages. That host can be your laptop,
a $5 VPS, a bare-metal box in a SOC, or anything in between. **The
self-host model unlocks the full feature set:**

- Real Git repositories per case on a real filesystem.
- The deep OSS subprocess toolchain (sherlock, maigret, subfinder,
  httpx, dnsx, amass, nuclei, exiftool, yt-dlp, tesseract, gowitness,
  …) called by the LLM during pipeline runs.
- AES-256-GCM-encrypted admin API-key vault.
- Cryptographic audit chain you control end-to-end.

If you just want a fast preview, deploy to Vercel instead — see
[`VERCEL_DEPLOY.md`](VERCEL_DEPLOY.md). That mode is intentionally
degraded (no subprocess tools, SHA-256 fallback for Git operations)
because Vercel's serverless runtime is read-only and ephemeral.

---

## Prerequisites

| | Version |
|---|---|
| Linux (Ubuntu 24.04 LTS is what we test against) | — |
| Node | 22+ |
| Bun | 1.3+ |
| Postgres (recommended for prod) or SQLite (fine for dev) | 16+ |
| Go (for ProjectDiscovery + amass + gowitness) | 1.23+ |
| Python | 3.11+ |
| Chromium / Chrome | latest (only needed for gowitness screenshots) |

A 2 GB / 2 vCPU box is the practical minimum; the LLM subprocess
tools will happily eat more RAM if you give it to them. 4–8 GB is
comfortable when running large nuclei sweeps in parallel with the
Next.js process.

---

## 1. Install the runtime

```bash
# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Bun (project runtime)
curl -fsSL https://bun.sh/install | bash

# Postgres (skip if using SQLite for local dev)
sudo apt install -y postgresql-16 postgresql-contrib
sudo -u postgres createuser --pwprompt forenix
sudo -u postgres createdb -O forenix forenix_oss
```

## 2. Install the deep OSS toolchain

This is what differentiates self-host from Vercel — the LLM picks
from these tools during pipeline runs and captures real output.

```bash
# Base utilities
sudo apt install -y \
  git unzip build-essential pkg-config libssl-dev ufw \
  python3 python3-pip python3-venv \
  exiftool tesseract-ocr chromium-browser

# Python OSINT tools — install into a project-scoped venv
python3 -m venv ~/osint-venv
source ~/osint-venv/bin/activate
pip install -U sherlock-project holehe theHarvester maigret yt-dlp
deactivate
# Symlink the binaries so the registry finds them on $PATH
for bin in sherlock holehe theHarvester maigret yt-dlp; do
  sudo ln -sf ~/osint-venv/bin/$bin /usr/local/bin/$bin
done

# Go (for ProjectDiscovery + amass + gowitness)
GO_VER=1.23.4
wget -qO /tmp/go.tgz https://go.dev/dl/go${GO_VER}.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf /tmp/go.tgz
sudo ln -sf /usr/local/go/bin/go /usr/local/bin/go

# ProjectDiscovery suite
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/owasp-amass/amass/v4/...@master
go install -v github.com/sensepost/gowitness@latest
sudo ln -sf ~/go/bin/* /usr/local/bin/

# One-time: pull nuclei templates
nuclei -update-templates -silent || true
```

Verify everything resolves on `$PATH`:

```bash
for t in sherlock maigret holehe theHarvester yt-dlp \
         subfinder httpx dnsx amass nuclei exiftool tesseract gowitness; do
  command -v "$t" >/dev/null && echo "  $t ✓" || echo "  $t MISSING"
done
```

## 3. Clone + configure

```bash
git clone https://github.com/thunderstornX/forenix-oss.git /opt/forenix
cd /opt/forenix
bun install
bunx prisma generate --schema=prisma/schema.postgres.prisma
```

Create `/opt/forenix/.env` (chmod 600):

```env
DATABASE_URL=postgresql://forenix:<password>@localhost:5432/forenix_oss
AUTH_SECRET=<openssl rand -hex 32>
NEXTAUTH_URL=http://<your-host>
AI_ADAPTER=mock                    # swap for ollama/groq/openrouter/etc.
FORENIX_FORCE_GIT=1                # force real isomorphic-git on disk
```

Bootstrap the schema + seed a demo case:

```bash
DATABASE_URL="$DATABASE_URL" bunx prisma db push \
  --schema=prisma/schema.postgres.prisma --accept-data-loss
DATABASE_URL="$DATABASE_URL" bun run prisma/seed.ts
```

Build:

```bash
bun run build
```

## 4. Run under systemd

`/etc/systemd/system/forenix.service`:

```ini
[Unit]
Description=forenix-oss
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=<forenix>
WorkingDirectory=/opt/forenix
Environment=NODE_ENV=production
EnvironmentFile=/opt/forenix/.env
ExecStart=/home/<forenix>/.bun/bin/bun run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now forenix
sudo systemctl status forenix
```

## 5. Front with Caddy (auto-HTTPS)

`/etc/caddy/Caddyfile`:

```caddy
forenix.yourdomain.com {
  reverse_proxy localhost:3000
  encode gzip
}
```

Caddy issues a Let's Encrypt cert on first start. Update
`NEXTAUTH_URL` in `.env` to match the domain, then restart the
service.

## 6. (Optional) Connect a real LLM

The Vault panel (Admin → Vault) accepts API keys at runtime —
they're AES-256-GCM-encrypted at rest using `AUTH_SECRET` as key
material. Alternatively, set them in `.env`:

```env
AI_ADAPTER=groq                    # or openrouter / nvidia / claude / ollama / glm
GROQ_API_KEY=gsk_…
GROQ_MODEL=llama-3.1-8b-instant
```

The adapter docstrings at `src/lib/ai/adapters/*.ts` document each
provider's expected env vars.

---

## Operational notes

- **Memory**: the LLM tool-loop can hold several subprocess tools in
  flight simultaneously. Allocate at least 2 GB to the host; 4 GB
  removes most paging risk.
- **Disk**: each case Git repository lives under
  `/opt/forenix/.case-repos/<caseId>/`. Plan capacity around your
  evidence volume.
- **Logs**: `journalctl -u forenix -f` is the canonical view.
  Audit chain integrity is also checked via the in-app Integrity
  Dashboard.
- **Updates**: `git pull && bun install && bun run build &&
  systemctl restart forenix`. Schema migrations: `bunx prisma db push`.
- **Backups**: `pg_dump forenix_oss` + tar the case-repo directory.
  Audit chain is self-verifying — restore + run the offline
  verifier (see [`07-SECURITY.md`](07-SECURITY.md)) to confirm
  nothing tore.
