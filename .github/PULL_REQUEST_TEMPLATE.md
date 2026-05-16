<!--
Thanks for the PR. Fill the sections below; delete the ones that don't apply.
-->

## What this changes

<!-- One paragraph. The "why" matters more than the "what". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Documentation
- [ ] Tooling / CI
- [ ] Other:

## Checklist

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun test` passes
- [ ] `bun run build` exits 0
- [ ] If schema changed, `bunx prisma validate` is clean for both `prisma/schema.prisma` and `prisma/schema.postgres.prisma`
- [ ] If a new mutating API route was added, it calls `appendAudit()`
- [ ] If a new AI adapter was added, it implements the four interface methods + is added to the factory + the pipeline-route Zod enum
- [ ] Docs updated where relevant (`README.md`, `docs/FEATURES.md`, `docs/HOW_TO.md`, `docs/USER_MANUAL.md`)
- [ ] `CHANGELOG.md` updated under `[Unreleased]`

## How to test

<!-- Concrete commands and what the reviewer should see. -->

## Screenshots / output

<!-- Only if the change is user-visible. -->
