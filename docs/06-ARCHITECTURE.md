# Architecture Decision Record — forenix-oss

A short ADR set covering the load-bearing decisions. Each entry
follows the *Context → Decision → Consequences* shape.

---

## ADR-001 — One web app, no microservices in 0.1

**Context.** Investigators have two distinct workflows (OSINT
collection vs. forensic case management) plus a shared audit chain.
A textbook approach would split this into 3+ services.

**Decision.** Ship one Next.js app. Use Prisma against one schema.
Use one process for the API surface, the React UI, and the
background pipeline.

**Consequences.**
- ✅ Trivial local install — one `bun run dev` and you have
  everything.
- ✅ The hash chain is consistent by construction (single writer).
- ✅ Deploying a small-team install is a single container.
- ⚠️ The pipeline runner is synchronous to its HTTP request; long
  LLM runs hold a Next route handler. Mitigated by a generous
  timeout and the future plan to off-load to a Bun worker.

---

## ADR-002 — AI Adapter pattern, single interface, six implementations

**Context.** OSINT pipelines and evidence triage need LLMs, but
the right LLM depends on jurisdiction, budget, and trust. SaaS
vendors lock you in; rolling each integration ad-hoc is a
maintenance disaster.

**Decision.** Define one TypeScript interface (`AIAdapter`,
`src/lib/ai/types.ts`) with four methods. Every concrete adapter
is a single file under `src/lib/ai/adapters/`. Factory selection is
env-driven (`AI_ADAPTER`). Per-call override is supported via
request body.

**Consequences.**
- ✅ Swapping providers is one env var.
- ✅ New providers (Groq, Together, Anyscale, …) are a copy of
  `openrouter.ts` away.
- ✅ The mock adapter is deterministic — UI screenshots are stable.
- ✅ A bad `AI_ADAPTER` value falls back to mock, never to a paid
  adapter.
- ⚠️ The interface is intentionally narrow (4 methods). More
  exotic flows (function-calling, tool-use, vision) will need a
  v2 interface — that's fine; the current interface is enough for
  the OSINT pipeline.

---

## ADR-003 — Append-only SHA-256 forward chain for audit

**Context.** Forensic chain-of-custody is the whole point. Stripe-
style "trust us, we have a database" doesn't survive a court
challenge. We need something an external party can verify without
our cooperation.

**Decision.** Every audit row carries a `hash = sha256(prevHash |
action | entity | entityId | iso(createdAt))`. The first row's
`prevHash` is `GENESIS_HASH` (32 zero bytes). `appendAudit()` is
the only public way to write. `verifyAuditChain()` replays the
whole table; the algorithm and constant are documented in
`docs/03-SDS.md` and `docs/04-DFD.md`.

**Consequences.**
- ✅ Tamper-evidence is a 30-line implementation.
- ✅ An external auditor with read access can reproduce the chain.
- ✅ The chain survives database migrations because it's computed
  over content, not row IDs alone.
- ⚠️ The chain is **global** — splitting it per-case would lose
  cross-workflow attestation; we judged that loss bigger than the
  cost of a single linear replay.
- ⚠️ We use SHA-256, not a Merkle tree. Linear replay is enough
  at sub-10M-row scale; Merkle batching is a Phase 8 add.

---

## ADR-004 — Prisma + SQLite for dev, Prisma + Postgres for prod

**Context.** We need a relational schema with FKs, joins, counts,
and the option to scale. Prisma gives a single ORM for both
SQLite and Postgres.

**Decision.** Schema is in `prisma/schema.prisma`. Dev runs
against SQLite (`file:./dev.db`). Prod runs against Postgres
(swap the `DATABASE_URL`).

**Consequences.**
- ✅ Zero environment setup for new contributors.
- ✅ The same migrations run against both databases.
- ⚠️ Some Postgres-specific features (`JSONB`, advisory locks,
  partitions) aren't used yet. When we need them, they'll go
  behind `provider`-aware Prisma helpers.

---

## ADR-005 — UI state in Zustand, server data in TanStack Query

**Context.** We need an SPA shell with a sidebar, a view router,
and a few cross-component states (active investigation, active
case, command palette). Server-fetched data needs caching +
invalidation.

**Decision.** Zustand (`src/lib/store.ts`) owns the UI shell.
TanStack Query (`src/lib/hooks.ts`) owns server data. No Redux.
No Context for state.

**Consequences.**
- ✅ Tiny bundle, no boilerplate.
- ✅ Every mutation declares exactly which queries it invalidates.
- ✅ `persist` middleware keeps `activeView` + sidebar collapse
  across page reloads.
- ⚠️ Persisted state has to be migrated by hand when the store
  shape changes — that's fine while the shape is stable.

---

## ADR-006 — One SPA route (`/`) with a Zustand view router

**Context.** A Next.js App Router project would naturally have
`/dashboard`, `/investigations`, `/cases/[id]`, etc. That gives
URL-based deep links but loses the snappy in-app feel of a single
React tree.

**Decision.** Render every view inside `src/app/page.tsx` based on
Zustand's `activeView`. Support URL query params
(`?view=audit&inv=…&case=…`) so deep links + screenshot capture
still work.

**Consequences.**
- ✅ Instant view switching — no route loading.
- ✅ The command palette is trivial to build (no router push).
- ✅ Screenshots can address every view by URL.
- ⚠️ Server-rendered SEO is sacrificed — that's fine; this app is
  for authenticated users.

---

## ADR-007 — SAAS_MODE as a single feature gate

**Context.** We want a real OSS product and a paid hosted tier.
Mixing billing logic into core feature paths is the classic open-
core trap.

**Decision.** A single env var (`SAAS_MODE=true`) gates every
premium feature *additively*. Core feature paths must work
identically whether `SAAS_MODE` is set or not. Premium features
that fail the gate either no-op or throw with a clear "premium-
only" message.

**Consequences.**
- ✅ The OSS deployment never touches billing code.
- ✅ Audit logs in OSS look identical to audit logs in SaaS — so
  forensic exports are portable.
- ✅ Premium feature graveyards (Shodan, Censys, Hunter, PDF
  export, multi-tenant org isolation, ClaudeAdapter) are easy to
  add without touching core paths.
- ⚠️ The OSS deployment cannot use ClaudeAdapter (by design).
  Mitigation: there are 5 other adapters; one of them is free.

---

## ADR-008 — Read-only references to the upstream projects

**Context.** The two predecessor projects (`_argus`, `_forenix`)
contain valuable context — schemas, agent prompts, design notes.
They also contain incompatible runtime deps (z-ai-web-dev-sdk,
custom hooks, …).

**Decision.** Ship both as read-only directories inside the repo
(`_argus/`, `_forenix/`). Source-cite copied blocks with
`// SOURCE: argus` / `// SOURCE: forenix`. Do not import from
either at runtime.

**Consequences.**
- ✅ Engineers can see the source design without context-switching
  repositories.
- ✅ The merge rationale is auditable.
- ⚠️ The reference dirs add ~4 MB to a fresh clone. Tsconfig +
  ESLint excludes prevent them from polluting builds.

---

## ADR-009 — Glassmorphism + dark-only theme

**Context.** Two predecessor projects used different visual
languages. The combined product needs one consistent design.

**Decision.** Dark theme only. Glass-morphism cards. Teal primary
accent (from Argus). Green for forensic accents (from ForenX).
Monospace hash display. `.forensic-glow` utility for active /
verified states.

**Consequences.**
- ✅ Consistent visual language across 15 views.
- ✅ Hash display is at-a-glance recognisable.
- ⚠️ No light theme — that's a Phase 8 polish item, not a P1.

---

## ADR-010 — SVG layouts, not D3 or Cytoscape

**Context.** We have three graph views (entity graph, branch
graph, network graph). D3 and Cytoscape are the obvious choices.

**Decision.** Hand-roll deterministic SVG layouts. No physics, no
force simulation. Each view's layout is < 50 LOC.

**Consequences.**
- ✅ Zero new runtime dependencies for graph rendering.
- ✅ Deterministic = screenshot-stable.
- ✅ Pure SVG works perfectly in PDF exports.
- ⚠️ No drag-to-reposition, no zoom/pan, no live physics. When
  the analyst needs those, we'll add them inline (still no D3).

---

## ADR-011 — Pure-helpers split for seed-time imports

**Context.** The seed script (`prisma/seed.ts`) runs outside
Next.js, so it can't import any module marked with `server-only`.
But it needs to compute audit-chain hashes during seeding.

**Decision.** Split the chain helpers into two files:
- `src/lib/audit-chain.ts` — pure functions, no Prisma, no
  `server-only`.
- `src/lib/audit.ts` — `server-only`, imports the pure helpers,
  adds the Prisma `appendAudit()` wrapper.

The seed imports only from `audit-chain.ts`.

**Consequences.**
- ✅ Seed runs without errors.
- ✅ App routes still benefit from the `server-only` marker.
- ⚠️ Two files instead of one. Small price for the clean
  boundary.
