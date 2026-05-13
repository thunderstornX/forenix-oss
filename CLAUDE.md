@AGENTS.md

# forenix-oss — Combined OSINT + Forensics Platform

## What this project is

A merged open-source platform that fuses two existing projects:

- **Argus** (under `_argus/`, read-only reference) — an OSINT
  intelligence platform with 7 AI agent groups that run parallel
  web searches and LLM analysis to build profiles on targets.
  Produces Investigations, Findings, an Entity graph, Monitors,
  Reports, and Verification workflows.
- **ForenX** (under `_forenix/`, read-only reference) — a digital
  forensics case manager. Git-style evidence chain-of-custody:
  Cases have Branches, Evidence has commits with a hash chain,
  Merge Requests gate review, an AI Lab schedules agent tasks,
  and an Integrity Dashboard verifies the audit-log hash chain.

The combined product is **forenix-oss**. The headline workflow:
OSINT investigations discover targets and produce intelligence
findings → those findings flow directly into forensic cases with
full chain-of-custody. One platform, two workflows reinforcing
each other.

## Source references

- `_argus/`   — reference only, do not modify, do not import from at runtime
- `_forenix/` — reference only, do not modify, do not import from at runtime
- Build everything new into `src/`, `prisma/`, `public/`

When code is adapted from a source project, prefix the block with a
`// SOURCE: argus` or `// SOURCE: forenix` comment.

## Stack

Next.js 16 (App Router), TypeScript strict, Tailwind 4, Prisma
(SQLite for dev, Postgres for prod), Zustand for UI state,
TanStack Query for server state, Framer Motion for animation,
lucide-react for icons, sonner for toasts, Bun as runtime.

## AI adapter pattern (mandatory)

All LLM calls go through `src/lib/ai/adapter.ts`. No component,
API route, or utility may call any AI SDK directly.

Adapters, in order:

1. **MockAdapter**   — deterministic seeded JSON, zero API calls.
2. **OllamaAdapter** — local Ollama, designed for Qwen2.5-7B.
3. **GLMAdapter**    — Zhipu AI API (GLM-4/5.x), sovereign option.
4. **ClaudeAdapter** — `@anthropic-ai/sdk`, SaaS premium tier only.

Active adapter is set by `AI_ADAPTER=mock|ollama|glm|claude`.
Default: `mock`. Never default to a paid adapter.

`MockAdapter` returns realistic structured data — invented entity
names, plausible hash digests, multi-section reports — so the UI
looks credible in demos without any AI infrastructure.

## Schema rules

- `prisma/schema.prisma` is a clean merge of both source schemas.
- `Investigation.caseId` is a nullable FK to `Case`.
- `Finding.evidenceId` is a nullable FK to `Evidence`.
- `Report` carries a `source: "investigation" | "case"` discriminator.
- `AuditLog` keeps ForenX's `hash` + `prevHash` fields. Every
  write to the audit log computes
  `sha256(prevHash + action + entity + entityId + timestamp)`.

These are the only cross-model bridges. Do not invent more.

## Open-source / SaaS split

- Core is MIT-licensed. Every core feature works self-hosted.
- SaaS premium features are gated by `process.env.SAAS_MODE === 'true'`:
  ClaudeAdapter, advanced OSINT sources (Shodan/Censys/Hunter),
  PDF report export, multi-tenant org management, usage metering.
- Billing logic and org-isolation queries must NEVER appear in
  core feature paths.

## Styling

Dark theme. Glassmorphism cards (semi-transparent backgrounds,
soft borders, backdrop blur). Teal primary accent. Monospace
hash display, chain-line connectors for audit trails.
`.forensic-glow` utility class for accent elements.

## Completion criteria

A phase is done when:
- `bun run typecheck` exits 0
- `bun run lint` exits 0
- `bun run db:seed` runs clean on a fresh database
- All seeded API routes return correct shapes
- The dev server boots and nav between views works in a browser
