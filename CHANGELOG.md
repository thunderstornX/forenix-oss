# Changelog

All notable changes to forenix-oss are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0]  -  2026-05

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

[Unreleased]: https://github.com/thunderstornX/forenix-oss/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.1.0
