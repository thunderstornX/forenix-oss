# Changelog

All notable changes to forenix-oss are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
