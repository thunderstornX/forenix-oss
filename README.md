```
   __                              _              _________ ___
  / _|                            (_)            / / __ ___|/ __|
 | |_ ___  _ __ ___ _ __ ___  __  ___  __ _    / / / / ___ \__ \
 |  _/ _ \| '__/ _ \ '_ \ | \/ / | |/ _` |  / / / / (_)   ||__/
 | || (_) | | |  __/ | | || |\ /  | | (_| | / / /   \___/ ||
 |_| \___/|_|  \___|_| |_|\_/\/   |_|\__,_|/_/_/      OSS  ||
                                                            \\
```

# forenix-oss

**OSINT × Forensics, one platform.**

forenix-oss merges two upstream platforms — **Argus** (an OSINT
investigation engine with seven AI agent groups) and **ForenX** (a
Git-style forensic case manager with hash-chained chain-of-custody) —
into one MIT-licensed Next.js app. The headline workflow:

> OSINT investigations discover targets and produce intelligence
> findings → those findings flow directly into forensic cases with
> full chain-of-custody.

The schema is one merged Prisma model with two new bridge columns
(`Investigation.caseId`, `Finding.evidenceId`). The audit log is
SHA-256 hash-chained so the Integrity Dashboard can replay every row
and prove no entry has been tampered with.

## Quick start

```bash
bun install
cp .env.example .env

bun run db:push      # apply schema to ./dev.db
bun run db:seed      # 3 users / 2 investigations / 1 case / 9 audit rows
bun run dev          # open http://localhost:3000
```

Smoke-test the API directly:

```bash
curl localhost:3000/api/health
curl localhost:3000/api/investigations | jq '.data | length'
curl localhost:3000/api/cases          | jq '.data | length'
```

## What's in the box (Phase 1)

| Layer | Files | Notes |
|---|---|---|
| **AI adapter** | `src/lib/ai/` | Interface + factory + `MockAdapter` (seeded deterministic data) + 3 stubs (`OllamaAdapter`, `GLMAdapter`, `ClaudeAdapter`). |
| **Unified schema** | `prisma/schema.prisma` | All 19 models merged. Two new bridge columns. `Report` carries a `source = "investigation" \| "case"` discriminator. |
| **Hash-chain audit** | `src/lib/audit.ts` + `src/lib/audit-chain.ts` | `appendAudit()` writes a row whose `hash = sha256(prevHash + action + entity + entityId + iso(createdAt))`. `verifyAuditChain()` replays the whole log. |
| **Seed** | `prisma/seed.ts` | 3 users, 2 investigations (1 linked to a case), 1 case w/ 2 branches + 3 evidence + 6 commits, 6 findings (2 linked to evidence), 2 monitors, 2 verifications, 3 reports, 2 agents + tasks, 9 audit rows w/ valid chain. |
| **App shell** | `src/app/` + `src/components/` | Dark + glassmorphism. Sidebar with 3 sections (OSINT / Pipeline / Forensics), collapsible, ⌘1–⌘9 view shortcuts. |
| **Working views** | Dashboard, Investigations, Cases | Each is fully wired to its API route, with create-via-form. |
| **Placeholder views** | 12 others | Stubbed with the same shell so the nav doesn't lie. |
| **API routes** | `src/app/api/{health,investigations,cases}/route.ts` | Zod-validated POST, audit-logged on create. |

## AI adapter pattern

Every LLM call in the codebase goes through `src/lib/ai/adapter.ts`:

```ts
import { getAdapter } from "@/lib/ai/adapter";

const ai = getAdapter();
const report = await ai.generateReport(investigation, findings);
```

The active adapter is selected by `AI_ADAPTER` (default: `mock`). The
factory will **never** fall through to a paid adapter on a bad value
— it falls back to mock. The four implementations:

| Adapter | Cost | Status | Setup |
|---|---|---|---|
| `mock` | free | ✅ shipped | none — works out of the box |
| `ollama` | free | stub (throws) | `ollama pull qwen2.5:7b-instruct`, then implement the POST in `src/lib/ai/adapters/ollama.ts` |
| `glm` | free tier | stub (throws) | register at [open.bigmodel.cn](https://open.bigmodel.cn), set `ZHIPU_API_KEY`, then implement the chat-completions POST |
| `claude` | paid | stub (throws) | requires `SAAS_MODE=true` + `ANTHROPIC_API_KEY`; reserved for premium tier |

### Free API keys to plug in

If you want to swap `mock` for real models, here is what's available
free or near-free at time of writing:

- **Ollama** — completely free, runs entirely on your machine. Best
  for `qwen2.5:7b-instruct` (~4.7 GB on disk). No API key needed.
- **Zhipu AI (GLM)** — `glm-4-flash` is currently free on the
  [open.bigmodel.cn](https://open.bigmodel.cn) developer plan; you
  get a generous monthly quota after sign-up.
- **Google AI Studio (Gemini)** — also has a free developer tier; we
  haven't shipped a `GeminiAdapter` yet but adding one is the same
  shape as `OllamaAdapter`.
- **Groq** — fast hosted Llama / Mistral / DeepSeek tier with a
  generous free quota for tinkering.

## Schema merge rules

- **Argus keeps:** `Investigation`, `Finding`, `EntityRelation`,
  `Monitor`, `MonitorRun`, `PipelineSchedule`, `Verification`,
  `Annotation`.
- **ForenX keeps:** `Case`, `Evidence`, `EvidenceCommit`, `Branch`,
  `MergeRequest`, `AgentTask`, `Agent`, `AgentAssignment`,
  `CaseAssignment`, `CaseMetric`, `Comment`.
- **`User`** comes from ForenX (Argus did not model it).
- **`Entity`** comes from Argus (ForenX did not model it).
- **`Report`** is merged: carries a `source` discriminator and the
  union of both projects' fields (`sections` JSON + `content`
  markdown).
- **`AuditLog`** keeps ForenX's `hash` + `prevHash` fields, with an
  added optional `investigationId` column so Argus's
  investigation-scoped audit events still flow through one ledger.

## Audit chain

```
sha256( prevHash | action | entity | entityId | iso(createdAt) )
```

`GENESIS_HASH` is 32 zero bytes hex-encoded. `verifyAuditChain()` in
`src/lib/audit.ts` replays the whole log in insertion order and
returns `{ ok: true, entries: N }` or
`{ ok: false, brokenAt: id, expected, got }`. The seed produces a
clean chain you can verify after `bun run db:seed`.

## Repo layout

```
src/
  app/
    api/
      health/route.ts           # GET — adapter + version
      investigations/route.ts   # GET list, POST create
      cases/route.ts            # GET list, POST create
    layout.tsx                  # root layout + providers
    page.tsx                    # view router with ⌘1–⌘9 shortcuts
    globals.css                 # tailwind + design tokens + .glass utilities
  components/
    layout/                     # sidebar, topbar
    views/                      # one component per top-level view
    providers.tsx               # TanStack Query client
  lib/
    ai/
      types.ts                  # wire contract for every adapter
      adapter.ts                # factory + getAdapter()
      adapters/                 # mock + 3 stubs
    audit.ts                    # appendAudit + verifyAuditChain
    audit-chain.ts              # pure SHA-256 helpers (importable from seed)
    db.ts                       # singleton PrismaClient
    hooks.ts                    # TanStack Query hooks
    store.ts                    # Zustand UI store + nav registry
    utils.ts                    # cn / shortHash / relTime
prisma/
  schema.prisma                 # merged schema (19 models, 2 bridges)
  seed.ts                       # full demo data + hash-chained audit log
```

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind 4 ·
Prisma 6 (SQLite for dev) · Zustand + persist · TanStack Query 5 ·
lucide-react · sonner · Bun as runtime.

## Roadmap

- ✅ Phase 1 — Foundation: adapter, schema, seed, shell, three API routes.
- Phase 2 — Investigation + Case detail views with full CRUD.
- Phase 3 — Pipeline runner (port from Argus, plumbed through the adapter).
- Phase 4 — Evidence chain-of-custody UI + Integrity Dashboard.
- Phase 5 — Unified entity / network graph.
- Phase 6 — AI Lab, Monitors, Verification.
- Phase 7 — Report builder + real adapter integrations (Ollama → GLM → Claude).
- Phase 8 — Docker Compose + demo mode + open-source release prep.

## License

MIT. See `LICENSE`.
