# Contributing to forenix-oss

Thanks for the interest. This document covers the contribution
flow — issues, pull requests, the test / typecheck / lint loop,
and the rules we'd like every PR to follow.

## Quick start

```bash
git clone https://github.com/thunderstornX/forenix-oss
cd forenix-oss
bun install
cp .env.example .env
bun run db:push
bun run db:seed
bun run dev
```

Open <http://localhost:3000>, sign in as
`admin@forenix-oss.local` / `forenix`, and you're in.

## Before you open a PR

Run all four locally:

```bash
bun run typecheck   # tsc --noEmit, must exit 0
bun run lint        # eslint, must exit 0
bun test            # bun:test runner, must pass
bun run build       # next build, must exit 0
```

CI runs all of these on every push. A red CI blocks merge.

## Branching + commits

- Branch off `main`. Name: `feat/<thing>`, `fix/<thing>`,
  `docs/<thing>`, `chore/<thing>`.
- Commit messages use Conventional Commits:
  - `feat: short imperative summary`
  - `fix(component): what broke and how`
  - `docs: …`
  - `chore: …` (tooling, CI, dependencies)
  - `refactor: …`, `test: …`, `perf: …` as needed.
- One logical change per commit. We prefer atomic commits over
  big mash-ups.

## What we want

| Welcome | Notes |
|---|---|
| New AI adapter | One file under `src/lib/ai/adapters/`. Use the shared `chat-completions.ts` helper if it's OpenAI-compat. Add to `AdapterName` union + factory + tests. |
| Bug fix | Include a regression test if at all possible. |
| New view | Use `ViewShell`. Add to `NAV` registry. Match the existing dark + glass design language. |
| Documentation | We over-document on purpose. PRs that improve docs are first-class. |
| New API route | Zod-validate the body. Use `requireSession()` and `teamScopeWhere()` where appropriate. Write an audit row through `appendAudit()`. |

## What we don't want (yet)

- New runtime dependencies for things that are already solved by
  what we have. The bundle stays small.
- Breaking changes to the audit-chain algorithm. The whole
  trust-anchor story rests on it.
- Premium-only features in core paths. SaaS-premium features
  gate behind `SAAS_MODE=true`; nothing else.
- UI framework swaps (no shadcn → MUI swaps, etc.).

## The two non-negotiables

1. **The audit chain must always close cleanly.** Any code path
   that writes to the database must either go through
   `appendAudit()` or not produce a state change. Adding a
   mutation that doesn't audit is a security regression.
2. **Adapter pattern is mandatory.** No direct AI SDK imports in
   API routes or components. Everything goes through
   `src/lib/ai/adapter.ts`.

## Adding a new AI adapter

The shape is fixed by `src/lib/ai/types.ts`:

```ts
interface AIAdapter {
  readonly name: AdapterName;
  analyzePipeline(target, agentGroup, searchResults): Promise<PipelineAnalysis>;
  extractEntities(findings): Promise<EntityExtractionResult>;
  tagEvidence(evidence): Promise<EvidenceTagResult>;
  generateReport(investigation, findings): Promise<string>;
}
```

For any OpenAI-compatible API, copy `adapters/groq.ts` and
change the URL + auth header + default model. Add the new name
to the `AdapterName` union, the factory `switch`, and the
pipeline-route Zod enum.

Tests: extend `chat-completions.test.ts` if your adapter relies
on a parsing path that isn't already covered.

## Code style

- TypeScript strict — no `any` unless commented and obviously
  unavoidable.
- Prefer `cn(…classes)` over conditional strings. We import
  `cn` from `@/lib/utils`.
- Server-only modules (those touching Prisma or environment
  secrets) get `import "server-only"` at the top.
- Comments explain *why*, not *what*. We trust the reader to
  read the code.

## Security disclosures

Don't open a public issue for security bugs. See `SECURITY.md`.

## Community standards

We follow the Contributor Covenant 2.1 — see
`CODE_OF_CONDUCT.md`.
