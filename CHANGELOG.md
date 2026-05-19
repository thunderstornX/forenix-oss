# Changelog

All notable changes to forenix-oss are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added - DigitalOcean auto-deploy + waitlist sync

Stops the DO droplet (demo.forenix.tech, the paid SaaS) from drifting
out of sync with `main`, and unifies the waitlist so admins on DO see
every signup from both surfaces.

- **`.github/workflows/deploy-droplet.yml`** - on every push to `main`
  (and via workflow_dispatch), checks out OSS Core + the private
  overlay (`thunderstornX/forenix-saas`, pulled via
  `SAAS_REPO_TOKEN`), assembles them, rsyncs onto the droplet, then
  runs the deploy script. Includes a `/api/health` smoke check.
- **`scripts/deploy-droplet.sh`** - runs on the droplet: install,
  prisma generate + push (postgres), build, `sudo systemctl restart
  forenix.service`. Idempotent; safe to re-run by hand.
- **`POST /api/admin/waitlist-import`** - token-gated receiver for
  signups arriving from another deployment. Idempotent on email,
  preserves the original createdAt so queue positions stay meaningful.
- **`POST /api/waitlist` forwards** - after the local upsert, fires a
  best-effort `POST` to `WAITLIST_SYNC_URL` with `Authorization:
  Bearer $WAITLIST_SYNC_TOKEN`. Vercel sets these env vars to point
  at the DO droplet so signups on forenix.tech mirror to
  demo.forenix.tech. Fire-and-forget; never blocks the user.
- **`scripts/sync-waitlist-once.ts`** - one-time backfill helper.
  Reads every waitlist row from the local DB and POSTs to
  `WAITLIST_SYNC_URL`. Idempotent.
- **`docs/09-RUNBOOK.md` §13 + §14** - full operator runbook for
  setting up the deploy secrets, droplet sudoers entry, and the
  cross-deployment sync (env vars + backfill).

### Changed

- **`chore(saas)`** (commit 14e52c4): premium tier extracted into a
  private overlay (`thunderstornX/forenix-saas`). Public repo no
  longer ships premium code. See [`docs/SAAS.md`](docs/SAAS.md) for
  the overlay model.

### Added - SSE live updates (Phase 9.3 / item 3 of 3, closes sprint)

The dashboard now reflects monitor runs, attestation runs, and
audit appends as they happen, without polling. Closes the Phase
9.3 sprint and makes the marketing "live verification" claim
literal.

- **`src/lib/events/{types,emitter}.ts`** - five typed topics
  (`monitor.run.{started,completed}`,
  `attestation.run.{started,completed}`, `audit.append`) and a
  process-singleton emitter on `globalThis` (HMR-safe). Wildcard
  channel for catch-all subscribers. Single-process for now; the
  SaaS lane will swap in Postgres LISTEN/NOTIFY without changing
  the public surface.
- **`GET /api/events`** - session-gated SSE endpoint with `?topics=`
  filter, 25 s keep-alive comments, `X-Accel-Buffering: no` for
  nginx, cleans up on the request's AbortSignal.
- **`src/hooks/use-live-events.ts`** - EventSource wrapper with
  exponential reconnect (1 s -> 30 s cap), topic filtering,
  ref-stable callback handling, and a `connected` flag for UI.
- **Producers wired**: `appendAudit()` emits `audit.append`;
  `runOneMonitor()` emits started + completed; `runAttestation()`
  emits started + completed (manual + scheduled paths produce
  identical event streams).
- **Consumers wired**: Monitors / Integrity / Audit views invalidate
  their TanStack Query keys on the relevant events. Topbar gains a
  small "live" pulse driven by the SSE connection state.
- **Tests** - 5 cases for the emitter (typed delivery, wildcard,
  topic isolation, unsubscribe, multi-subscriber). All 80 tests
  across the suite pass.

### Added - cron-triggered attestations (Phase 9.3 / item 2 of 3)

Closes the strongest gap in the chain-of-custody story: the
"Attest now" button was always manual, which meant the chain
witnesses were only as fresh as the operator's memory. This wires
the cron infrastructure shipped in item 1 to fire attestations too.

- **`AttestationSchedule` Prisma model** - one row per backend
  you want fired automatically. Each can run on its own cadence
  (typical setup: local hourly + github daily + rekor weekly).
- **`src/lib/attestation/scheduler.ts`** - reuses
  `runAttestation()` so the cron path and the manual button produce
  identical Attestation rows. Failures advance the schedule (one
  network blip can't permanently disable a backend) and the error
  is surfaced in the schedule row's `lastError`.
- **`POST /api/internal/attest-tick`** - same auth gate as
  monitor-tick (`MONITOR_CRON_TOKEN` or `CRON_SECRET`, with or
  without `Bearer` prefix).
- **Admin routes**:
    - `GET / POST /api/admin/attestation-schedule`     list / create
    - `PATCH / DELETE /api/admin/attestation-schedule/[id]`  pause/
                                                              resume,
                                                              edit cadence,
                                                              delete
- **Integrity dashboard** gains a "Scheduled attestations" panel
  (admin only): backend column, cadence picker, status pill,
  last-run / next-run, per-row pause/resume + delete, last-error
  display when a run failed.
- **`vercel.json`** gains an `attest-tick` cron entry at 8:30am
  daily (still Hobby-compliant: 2 entries, both daily).
- **`.github/workflows/cron-tick.yml`** (renamed from monitor-tick)
  adds a separate `attest` job so a slow Rekor anchor doesn't delay
  the next monitor tick.
- Every schedule action appends an audit row
  (`attestation_schedule_created`, `_paused`, `_resumed`,
  `_updated`, `_deleted`) so the chain notarises its own scheduling
  alongside its events.
- `docs/09-RUNBOOK.md` §12 covers cadence pairings, drivers, and
  operator setup.

### Added - scheduled monitors (Phase 9.3 / item 1 of 3)

The Monitor rows have always carried `cadence` + `nextRunAt`
columns; this turn finally wires a scheduler that fires them.

- **`src/lib/monitor-scheduler/`** - new module:
    - `cadence.ts`        - parser for the cadence DSL
                            (`hourly`/`daily`/`weekly`/`monthly` or
                            `every:N(m|h|d)`), with a 1-min floor
                            and a 90-day ceiling. 14 pure-function
                            tests for the grammar + the `isDue`
                            grace-window predicate.
    - `scheduler.ts`      - `runMonitorTick()` finds active rows
                            where `nextRunAt <= now + 60s grace`,
                            runs each through the always-available
                            HTTP tool subset (`web_search` +
                            `crtsh_certificates` for now -  enough
                            to prove the wiring without needing
                            subprocess deps on Vercel), persists a
                            `MonitorRun` row, advances `nextRunAt`.
                            Failures still advance the schedule so
                            one bad tick doesn't permanently disable
                            a monitor.
- **`POST /api/internal/monitor-tick`** - token-gated endpoint that
  both cron drivers POST into. Accepts either `MONITOR_CRON_TOKEN`
  or Vercel's built-in `CRON_SECRET`, with `Bearer` prefix optional.
- **`vercel.json`** gains a `crons` block that hits the tick every
  5 minutes; `docs/09-RUNBOOK.md` documents the matching systemd
  timer for the Droplet.
- **Monitor CRUD now exists**:
    - `POST   /api/monitors`         create (investigator+)
    - `PATCH  /api/monitors/[id]`    pause/resume, change cadence,
                                      change target
    - `DELETE /api/monitors/[id]`    delete (investigator+)
    - `POST   /api/monitors/[id]/run` run-now (bypasses next tick)
  Every state-change appends an audit row (`monitor_created`,
  `monitor_paused`, `monitor_resumed`, `monitor_updated`,
  `monitor_run`, `monitor_deleted`) so the chain notarises the
  schedule alongside the cases.
- **Monitors view** in the authed app gains controls:
  'New monitor' header action with a cadence picker, per-card
  'Run now' / 'Pause' / 'Resume' / cadence-select / 'Delete' under
  a hairline divider. Read-only for analysts/viewers; mutating
  controls hidden for them.
- **`.env.example`** documents `MONITOR_CRON_TOKEN`; the Vercel
  surface uses the built-in `CRON_SECRET` set in the project env.
- Test count: 61 -> 75 (14 new cadence-parser tests).

## [0.4.0] - 2026-05-17

External attestation of the audit chain head. Closes the long-standing
"DB admin rewrites + re-signs the whole chain" gap in the threat model
that's been sitting in the roadmap since v0.2.0.

### Added - external attestation of the audit chain

- **New `Attestation` model** + `src/lib/attestation/` library
  implementing the long-standing "DB admin rewrites + re-signs the
  whole chain" gap in the threat model. The chain alone proves
  no-tampering only against attackers without DB-write access;
  external attestations pin the head hash periodically to a witness
  the maintainer can't unilaterally rewrite.
- **Three backends ship now, more without schema changes:**
    - `local`  - HMAC-SHA256 over the head, keyed on `AUTH_SECRET`.
      Always-available; offline-verifiable; catches accidental
      corruption + naive tampering. Honest about not being external.
    - `github` - posts the head as a JSON comment to a designated
      issue. GitHub's per-comment edit history makes tampering
      detectable, not impossible.
    - `rekor`  - posts an Ed25519-signed `hashedrekord` entry to the
      public Sigstore transparency log (https://rekor.sigstore.dev).
      Inclusion proofs + signed-entry-timestamps issued by Sigstore's
      own keys and replicated across the network. Trust shrinks to
      "Sigstore didn't conspire with the maintainer."
- **`/api/attestation` route**: `GET` lists recent witnesses,
  `POST` (admin-only) records a new one; `GET /:id/verify`
  re-fetches the witness and confirms it still pins the original
  head.
- **Integrity dashboard now surfaces attestations** below the chain
  status: backend, short head hash, status, external link, per-row
  "Verify now" button. Admin sees an "Attest now" control + a
  per-run backend override.
- **The attestation event is itself an audit row**
  (`action=attest_chain`). So the next attestation witnesses the
  previous attestation — the witness history is itself tamper-
  evident.
- **Rekor keypair** is a lazy-generated Ed25519 pair under
  `REKOR_KEY_DIR` (defaults to `.attestation-keys/`), 0600 on the
  private key, gitignored via both `*.pem` and an explicit dir rule.
- 22 new tests across `local.test.ts`, `github.test.ts`, and
  `rekor.test.ts` (HMAC + envelope + Rekor-codec round-trips,
  tamper-detection, secret-rotation, tolerant parse). Bun test
  count: 39 -> 61.
- Docs: new "External attestation of the chain head" section in
  `docs/07-SECURITY.md` (threat model, three-backend table,
  configuration, compromise drill).
- `.env.example`: `ATTESTATION_BACKEND`, the `ATTEST_GITHUB_*`
  block, and the `REKOR_*` block under a new section.

### Fixed

- **Middleware auth was breaking under HTTPS reverse proxy** (Caddy
  on the self-host, Vercel edge on the serverless surface).
  `getToken({ req })` inferred `secureCookie` from `req.url`, which
  for proxied requests is always the internal `http://localhost:3000`,
  so it looked for the non-`Secure-` cookie name. Browsers + curl
  rightly sent the `__Secure-authjs.session-token` cookie issued
  under HTTPS, so getToken never found it and the middleware 401-ed
  every protected route. Fixed by computing `isHttps` from
  `AUTH_URL/NEXTAUTH_URL` (`https://...`) or
  `X-Forwarded-Proto: https` and passing `secureCookie: isHttps`
  explicitly. Same bug recurrence as the nip.io attempt in v0.2.0.

### Added - live domains

- **forenix.tech** registered (GitHub Student Pack via the .tech
  registry). Wired so:
    - `forenix.tech` + `www.forenix.tech` -> Vercel (concept demo).
    - `demo.forenix.tech` -> DigitalOcean Droplet (full feature demo
      with HTTPS via Caddy auto-Let's Encrypt).
- README now lists the canonical demo URLs in the "Deployment models"
  section.

## [0.3.0] - 2026-05-17

Real file bytes on disk and a forensic-grade PDF report. The two
items most-mentioned as missing in the v0.2.0 review.

### Added - file-byte evidence storage (Phase 9.1)

- **Content-addressed disk store** at `src/lib/evidence-store.ts`.
  Streams uploaded bytes through a SHA-256 hash, writes to
  `{store}/{caseId}/{sha[:2]}/{sha}` atomically (temp file + rename),
  deduplicates identical bytes within a case automatically. Hard cap
  per upload at 500 MB (configurable).
- **Evidence schema** gained two new columns:
    - `objectKey String?`  - the content-addressed relative path on disk.
      Non-null means the evidence has a real underlying file.
    - `byteCount BigInt`   - the file size in bytes.
  The `hash` column on these rows is now SHA-256 *over actual bytes*
  (forensic identity), not over finding text.
- **New endpoints**:
    - `POST /api/evidence/upload` (multipart/form-data: caseId + file)
    - `GET  /api/evidence/[id]/download` (streams bytes back to caller, audits the access)
    - `POST /api/evidence/[id]/verify-bytes` (re-hashes the file on disk, audits the result)
- **Upload UI** on the Evidence view: drag-or-pick a file, choose a
  case, submit. Hash is computed server-side as bytes stream through.
- **Vercel graceful degradation**: `evidenceStorageEnabled()` returns
  false on Vercel; the upload route 503s with a clear message. The UI
  shows an explanatory toast.
- **Test coverage**: 8 new tests for the store (`src/lib/evidence-store.test.ts`)
  covering content-addressed pathing, dedup, re-hash + verify,
  tamper detection, path-traversal rejection, empty-upload rejection,
  maxBytes enforcement.

### Added - PDF export of admissible reports (Phase 9.2)

- **`src/lib/case-report.ts`** - HTML renderer for a forensic-grade
  case report:
    - Cover page with case metadata + custodian + report timestamp.
    - **Chain-of-custody attestation block** showing chain length, head
      hash, genesis hash, verify status, and a SHA-256 report digest
      over the report contents themselves (so a printed PDF can be
      tied to a known state of the case).
    - Evidence inventory table (name, type, status, size, SHA-256,
      object key, added timestamp).
    - Findings (up to 50) with agent group, confidence, priority,
      verification status, description + reasoning-trace excerpt.
    - Audit log sample (last 100 entries) with timestamp, action,
      entity, actor, hash.
  Light-theme print-ready; uses the same OKLCH design tokens as the app.
- **`GET /api/cases/[id]/report`** (HTML preview) and
  **`?format=pdf`** (Playwright-rendered A4 PDF download).
- **Export buttons** on the Case detail view: "Export PDF" and "Preview"
  (HTML in a new tab).
- **Vercel graceful degradation**: PDF format requires Chromium, which
  Vercel can't spawn. Returns 503 with a clear message; the HTML
  preview works everywhere.

## [0.2.0] - 2026-05-17

The "Monster Mode" release. Real Git per case, real LLM tool-loop
with 20 wired OSINT tools, encrypted admin vault, structured-analytic
trace per finding, full theme system.

### Added - investigative depth

- **Per-case Git repositories** via isomorphic-git. Real commits,
  branches, merges, conflict detection. Cloneable and inspectable
  without the app running. `FORENIX_FORCE_GIT=1` opts in on hosts
  with persistent disk; serverless hosts fall back to deterministic
  SHA-256 commit hashes (so the UX never lies about which mode).
- **20 OSINT tools wired** into a unified registry with OpenAI-shape
  function definitions:
    - HTTP-first (works everywhere): DuckDuckGo, generic HTTP fetch,
      crt.sh, WHOIS lookup, Shodan, Hunter.io, HaveIBeenPwned.
    - Subprocess (self-host only): sherlock, holehe, theHarvester,
      maigret, subfinder, httpx, dnsx, amass, nuclei, exiftool,
      yt-dlp, tesseract, gowitness.
- **LLM tool-loop** (`src/lib/ai/tool-loop.ts`) - multi-step
  function-calling loop that lets the model pick which tools to run,
  feeds tool output back, and finalises with structured findings.
- **SAT-grounded prompting** (`src/lib/ai/sat-prompts.ts`) - per-agent-
  group system prompts that force the LLM to emit a structured Coulthart
  / Heuer trace (Key Assumptions Check, ACH matrix, indicators,
  credibility scoring).
- **Encrypted API-key vault** - `ApiKey` model + AES-256-GCM at rest
  (`src/lib/secrets.ts`); admin-only UI in the Vault panel; keys
  injected into `process.env` only when invoking tools.

### Added - UI

- **Enterprise design tokens** via OKLCH colour space - light + dark
  themes, 5 accent palettes (slate / indigo / amber / emerald / mono),
  3 density modes (compact / standard / comfortable).
- **Theme system** (`src/lib/theme.tsx`) - persistent light/dark
  toggle + accent picker in the topbar; flash-free SSR via inline
  pre-paint script.
- **fx-* primitive layer** (`fx-app`, `fx-side`, `fx-top`, `fx-card`,
  `fx-btn`, `fx-input`, `fx-chip`, `fx-table`, `fx-stat`...) refactored
  out of the legacy glass / forensic-glow utilities. Back-compat
  shim keeps existing view components working through the migration.
- **Designed SVG banner** (`docs/banner.svg`) replacing the ASCII text
  banner in the README.

### Added - resilience

- **Pipeline route never 500s on LLM trouble**. If the model emits
  malformed JSON or empty content after the tool-loop, `chatAnalyze-
  Pipeline` emits a sentinel finding capturing the raw output + parse
  error. `chatExtractEntities` and `chatTagEvidence` similarly tolerate
  bad output.
- **`extractJson` hardened** with brace-walking JSON-end detection,
  trailing-prose tolerance, and a comma-strip repair fallback before
  giving up.
- **`chatComplete` returns "" instead of throwing** on empty completions
  - reasoning-style models routed via OpenRouter sometimes return only
  the `reasoning` field with no `content`.

### Added - deployment story

- **Three independent deployment shapes** from the same codebase, all
  documented in the README:
    1. **Self-host (mock)** - full UI, deterministic data, no API key.
    2. **Self-host + real LLM + deep toolchain** - full feature parity.
    3. **Serverless concept demo (Vercel)** - gracefully degraded
       (SHA-256 git fallback, HTTP-API tools only, instant load).
- **`docs/SELF_HOST.md`** - complete Ubuntu 24.04 walkthrough
  (runtime, deep OSS toolchain install, env, systemd, Caddy
  reverse-proxy auto-HTTPS, optional LLM wiring).
- **GitHub-button-style one-click Vercel deploy** in the README.

### Changed - hygiene

- README rewritten - no demo-credential disclosure (platform is now
  invite-only operationally); generic LLM adapter section with no
  provider recommendation; clearer three-tier deployment narrative.
- **All 28 screenshots regenerated** against the new redesign UI.
  Old `docs/screenshots/` removed; `docs/manual_screenshots/` is the
  single canonical set.
- Sign-in page no longer pre-fills the admin email/password.
- Manual-screenshot driver (`scripts/manual_screenshots.mjs`) now
  signs in as the seeded admin automatically.
- Typography pass across all `.md` and code files: em dashes,
  en dashes, ellipses, middle dots, multiplication signs, and the
  warning/check-mark emoji set normalised to ASCII equivalents.
- `next.config.ts` dropped `output: "standalone"` - was leaking
  "next start does not work with output: standalone" warnings into
  production logs.

### Removed

- **YC pitch material** (`docs/pitch/`, `scripts/gen_pitch_deck.py`).
  This was private and never belonged in the public repo.
- Old `docs/screenshots/` directory (pre-redesign frames).

### Security

- API keys stored in the new `ApiKey` table are encrypted at rest
  with AES-256-GCM. `AUTH_SECRET` is the key material; ciphertext +
  iv + tag are stored separately. `preview()` returns a redacted
  representation for the admin UI.
- All vault-decrypted keys are injected into `process.env` lazily
  per request and bounded by a 30 s in-memory cache.

## [0.1.0] - 2026-05

The first tagged release. Open-source core complete and
production-ready.

### Added  -  platform

- **Merged Prisma schema** combining the Argus OSINT model with
  the ForenX forensic case model. Two new bridge columns:
  `Investigation.caseId` and `Finding.evidenceId`. New `Team`,
  `TeamMember`, `TeamInvite` models with optional `teamId` on
  `Case` + `Investigation`.
- **AI adapter pattern**  -  one interface (`src/lib/ai/types.ts`),
  six concrete adapters: `mock`, `ollama` (stub), `glm` (stub),
  `claude` (stub, SaaS-gated), `openrouter`, `nvidia`, `groq`.
  Two are live-tested end-to-end (NVIDIA and OpenRouter and Groq).
- **Audit hash chain**  -  SHA-256 forward chain over every state
  change. `appendAudit()` is the only legal write path.
  `verifyAuditChain()` replays the whole log; the UI exposes
  one-button verification.
- **15 views**  -  Dashboard, Investigations (list + detail),
  Pipeline runner, Cases (list + detail), Evidence, Branch Graph
  (SVG), Entity Graph (SVG), Network Graph (SVG), Monitors,
  Verification, AI Lab, Reports, Audit, Integrity, Reviews.
  Plus account-side: Teams, Settings, Admin.
- **Command palette ⌘K** with searchable jump-to across nav +
  investigations + cases + reports.
- **Analyst actions**  -  verify finding, promote finding to
  evidence, seal evidence; each writes an audit row.
- **Cursor pagination** on the heavy list endpoints
  (`/api/investigations`, `/api/cases`, `/api/audit`,
  `/api/evidence`).
- **Inline filters** on every list view.
- **URL deep-links**  -  `?view=...&inv=...&case=...&palette=1`.

### Added  -  auth + RBAC

- **next-auth v5** with credentials provider and JWT sessions.
- **RBAC** via `requireSession()` + `requireRole()` + four
  global roles (admin / investigator / analyst / viewer).
- **Team scope**  -  `teamScopeWhere(actor)` filters list queries
  automatically. Admins bypass.
- **Sign-in page** with three seeded demo accounts pre-listed.
- **Admin console**  -  manage users (create / role-change /
  enable-disable), teams (create with slug validation), and
  generate invite links (token-gated, copy-to-clipboard UX).
- **Teams view**  -  every authenticated user sees their own
  memberships + members.
- **Accept-invite flow** at `/accept-invite?token=...`.

### Added  -  infrastructure

- **GitHub Actions CI** (`.github/workflows/ci.yml`)  -  typecheck,
  lint, Prisma validation (both schemas), tests, seed smoke,
  build. Runs on every push and PR.
- **Bun test runner**  -  15 tests covering audit-chain
  determinism + tamper-detection, and the chat-completions
  JSON extractor.
- **Production Dockerfile**  -  multi-stage (deps -> builder ->
  runtime) on `node:20-slim`. Non-root user. HEALTHCHECK on
  port 3000.
- **docker-compose**  -  one command brings up Postgres + the app.
- **Vercel deploy path**  -  `vercel.json`, Postgres-flavoured
  Prisma schema, `vercel-build` script, `maxDuration = 60` on
  the pipeline route, token-gated `/api/admin/seed-demo`
  bootstrap endpoint.

### Added  -  documentation

- 9 long-form docs under `docs/` covering BRD, SRS, SDS, DFD,
  Deployment, Architecture, Security, API, and Runbook.
- **User Manual**  -  42-page PDF with embedded screenshots.
- **How-To Guide**  -  25-page PDF with task-oriented recipes.
- **YC pitch deck**  -  17-slide editable `.pptx` + PDF.
- **Feature catalogue** at `docs/FEATURES.md` with one section
  per view.

### Security

- Audit chain documented + verifiable offline in ~12 lines of
  Python.
- Zod-validated POST/PUT bodies on every mutating route.
- `server-only` marker on every server module that touches
  Prisma or env secrets.
- Factory deliberately falls back to `mock` on a bad
  `AI_ADAPTER` value  -  never to a paid adapter.
- Adapter HTTP calls have a 90 s AbortController timeout.

[Unreleased]: https://github.com/thunderstornX/forenix-oss/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.3.0
[0.2.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.2.0
[0.1.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.1.0
