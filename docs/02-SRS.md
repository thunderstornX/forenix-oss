# Software Requirements Specification  -  forenix-oss

| Field | Value |
|---|---|
| Document | Software Requirements Specification (SRS) |
| Product | forenix-oss |
| Version | 0.1 |
| Standard | IEEE 830-compatible |
| Status | Living document |

## 1. Introduction

### 1.1 Purpose

This document captures the functional and non-functional
requirements of forenix-oss to a level of detail sufficient for
engineering implementation, QA test planning, and external review.

### 1.2 Scope

forenix-oss is a single web application (Next.js 16) backed by a
relational database (SQLite for dev, Postgres for prod). It owns
the lifecycle of an OSINT investigation, the lifecycle of a
forensic case, and the bridge between them. The application is
single-tenant in 0.1; the database schema is structured so that
multi-tenancy is a non-breaking migration.

### 1.3 Definitions

- **Investigation**  -  an OSINT collection workspace bound to a
  *target* (person / org / domain / IP / etc.).
- **Finding**  -  a discrete signal produced by an agent group inside
  an investigation. Carries confidence + priority.
- **Entity**  -  a normalised actor (person / org / domain / IP /
  email / phone / account / location) shared across investigations.
- **Case**  -  a forensic workspace owning evidence and review.
- **Evidence**  -  an artefact under chain of custody, carrying a
  content hash + commit history.
- **Branch / Commit / MergeRequest**  -  Git-like primitives over the
  evidence collection.
- **Audit row**  -  an append-only record of an action; carries a
  SHA-256 forward-chain hash.
- **Adapter**  -  concrete implementation of the AI interface used by
  the pipeline.
- **Bridge**  -  the act of opening a Case from an Investigation,
  setting `Investigation.caseId`, and optionally promoting findings
  to Evidence.

### 1.4 References

- BRD: `docs/01-BRD.md`
- Feature catalogue: `docs/FEATURES.md`
- Source schemas: `_argus/prisma/schema.prisma`, `_forenix/prisma/schema.prisma`

## 2. Overall description

### 2.1 Product perspective

The product is a merged successor to two predecessor projects
(`_argus` and `_forenix`), both read-only references inside the
repository. The merge is documented in `prisma/schema.prisma`.

### 2.2 User classes

| Class | Frequency | Privilege |
|---|---|---|
| `admin` | rare | full read/write everywhere |
| `investigator` | daily | read/write on assigned cases |
| `analyst` | daily | read/write on findings, read on evidence |
| `viewer` | occasional | read-only |

(RBAC enforcement is part of the SaaS-premium tier; v0.1 treats
all authenticated users as a single role.)

### 2.3 Operating environment

- **Server:** Node.js 20+ / Bun 1.3+, sqlite3 or Postgres 14+.
- **Browser:** Chromium 110+, Firefox 110+, Safari 16+.
- **Optional:** Ollama (local LLM), OpenRouter / NVIDIA NIM /
  Anthropic API (hosted LLMs).

### 2.4 Constraints

- All LLM calls go through `src/lib/ai/adapter.ts`. No direct SDK
  calls anywhere else in the codebase.
- No code in `_argus/` or `_forenix/` is imported at runtime.
- Every audit-mutating route writes through
  `appendAudit()` so the chain stays valid.

## 3. Functional requirements

### 3.1 Investigation lifecycle

| ID | Requirement |
|---|---|
| FR-INV-1 | `POST /api/investigations` creates a draft investigation with the given target/objective; validation per Zod schema; audit row appended |
| FR-INV-2 | `GET /api/investigations` lists every investigation with finding/monitor/report counts |
| FR-INV-3 | `GET /api/investigations/[id]` returns the full detail including findings, monitors, reports, entities, and the audit trail |
| FR-INV-4 | `POST /api/findings/[id]/verify` marks a finding verified and records the verifier (audit row) |
| FR-INV-5 | `POST /api/findings/[id]/promote` mints an Evidence row on the linked Case and stamps `Finding.evidenceId` (audit row) |

### 3.2 Pipeline runner

| ID | Requirement |
|---|---|
| FR-PIPE-1 | `POST /api/pipeline/run/[id]` accepts `agentGroups` + optional `adapter` override |
| FR-PIPE-2 | Each agent group runs `analyzePipeline()` in parallel via `Promise.all` |
| FR-PIPE-3 | After all agents complete, `extractEntities()` runs over the combined findings |
| FR-PIPE-4 | Then `generateReport()` produces a markdown report tied to the investigation |
| FR-PIPE-5 | Every step writes an audit row and the chain stays valid |
| FR-PIPE-6 | Investigation status transitions: `draft -> running -> complete` (or `failed`) |

### 3.3 Case lifecycle

| ID | Requirement |
|---|---|
| FR-CASE-1 | `POST /api/cases` opens a case with auto-assigned `CASE-YYYY-NNN` number and a `main` branch |
| FR-CASE-2 | `GET /api/cases` lists open cases with evidence/branch/investigation counts |
| FR-CASE-3 | `GET /api/cases/[id]` returns evidence + commits + branches + assignments + audit trail |
| FR-CASE-4 | `POST /api/bridge/inv-to-case/[id]` opens a case bound to the investigation, optionally promotes every finding |
| FR-CASE-5 | `POST /api/evidence/[id]/seal` flips status to `sealed`, writes a `seal` commit on `main`, audit row |

### 3.4 Audit + integrity

| ID | Requirement |
|---|---|
| FR-AUD-1 | Every mutating route appends one audit row via `appendAudit()` |
| FR-AUD-2 | `appendAudit()` computes `hash = sha256(prevHash | action | entity | entityId | iso(createdAt))` |
| FR-AUD-3 | `GET /api/audit` lists rows; supports `investigationId` and `caseId` filters |
| FR-AUD-4 | `GET /api/audit/verify` replays the entire chain; returns `{ ok, entries }` or `{ ok:false, brokenAt, expected, got }` |
| FR-AUD-5 | A row whose `prevHash` does not equal the previous row's `hash` is highlighted in the Audit view |

### 3.5 Cross-cutting

| ID | Requirement |
|---|---|
| FR-X-1 | Every list view supports an inline text filter |
| FR-X-2 | Every view is keyboard-reachable via the command palette (⌘K) |
| FR-X-3 | Every detail page links back to its list view |
| FR-X-4 | Every action button shows a spinner while pending and a toast on completion/failure |

## 4. Non-functional requirements

### 4.1 Performance

| ID | Requirement |
|---|---|
| NFR-P-1 | List endpoints respond < 200 ms p95 on the seeded dataset |
| NFR-P-2 | Audit-chain verification across 10 000 rows < 5 s |
| NFR-P-3 | Pipeline run with mock adapter < 1 s end-to-end |
| NFR-P-4 | Pipeline run with hosted LLM (NVIDIA / OpenRouter) <= 90 s |

### 4.2 Reliability

| ID | Requirement |
|---|---|
| NFR-R-1 | A single adapter failure must not corrupt the audit chain |
| NFR-R-2 | Re-seeding a fresh database always produces a valid chain |
| NFR-R-3 | Re-running a pipeline against an already-running investigation is idempotent at the finding level (no duplicate writes)  -  *future enhancement* |

### 4.3 Security

| ID | Requirement |
|---|---|
| NFR-S-1 | No secrets in source; all keys come from `.env` (gitignored) |
| NFR-S-2 | Zod validation on every POST/PUT body |
| NFR-S-3 | `server-only` marker on every server-only module |
| NFR-S-4 | Adapter factory never falls back to a paid adapter on bad env |
| NFR-S-5 | Hash-chain method is documented + reproducible by a third party |

### 4.4 Maintainability

| ID | Requirement |
|---|---|
| NFR-M-1 | `bun run typecheck` exits 0 |
| NFR-M-2 | `bun run lint` exits 0 |
| NFR-M-3 | Every concrete adapter is a single file under `src/lib/ai/adapters/` |
| NFR-M-4 | Every new view goes through `ViewShell` for consistency |

### 4.5 Portability

| ID | Requirement |
|---|---|
| NFR-PT-1 | The same code path runs on Linux, macOS, Windows-WSL |
| NFR-PT-2 | Database is swappable (SQLite <-> Postgres) via Prisma alone |

## 5. External interfaces

### 5.1 API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | adapter + version + saas-mode |
| GET | `/api/investigations` | list |
| POST | `/api/investigations` | create (Zod) |
| GET | `/api/investigations/[id]` | detail |
| POST | `/api/pipeline/run/[id]` | run pipeline |
| POST | `/api/bridge/inv-to-case/[id]` | bridge to case |
| POST | `/api/findings/[id]/verify` | verify |
| POST | `/api/findings/[id]/promote` | promote to evidence |
| GET | `/api/cases` | list |
| POST | `/api/cases` | create |
| GET | `/api/cases/[id]` | detail |
| POST | `/api/evidence/[id]/seal` | seal |
| GET | `/api/evidence` | list (caseId filter) |
| GET | `/api/entities` | list (investigationId filter) |
| GET | `/api/monitors` | list |
| GET | `/api/verifications` | list |
| GET | `/api/agents` | list |
| GET | `/api/reports` | list |
| GET | `/api/reports/[id]` | detail |
| GET | `/api/reviews` | merge-request list |
| GET | `/api/audit` | audit log |
| GET | `/api/audit/verify` | chain verification |
| GET | `/api/network` | cross-case knowledge graph |

Full reference + payload shapes: `docs/08-API.md`.

### 5.2 Adapter interface

Defined in `src/lib/ai/types.ts`:

```ts
interface AIAdapter {
  readonly name: AdapterName;
  analyzePipeline(target, agentGroup, searchResults): Promise<PipelineAnalysis>;
  extractEntities(findings): Promise<EntityExtractionResult>;
  tagEvidence(evidence): Promise<EvidenceTagResult>;
  generateReport(investigation, findings): Promise<string>;
}
```

Concrete implementations: `mock`, `ollama`, `glm`, `claude`,
`openrouter`, `nvidia`.

## 6. Acceptance criteria

A release ships when **all** of the following hold:

1. `bun run typecheck` exits 0.
2. `bun run lint` exits 0.
3. `bun run db:seed` runs clean on a fresh database.
4. Every endpoint in §5.1 returns its documented shape.
5. `verifyAuditChain()` returns `{ ok: true, entries: N }` against
   the seeded baseline.
6. The dev server boots and renders every view without runtime
   errors in the browser console.
7. A live OpenRouter run completes against `INV-2025-020`,
   producing >= 3 findings, >= 2 entities, with a clean chain.
8. A live NVIDIA run completes against `INV-2025-019`, producing
   >= 3 findings, >= 2 entities, with a clean chain.

(Items 7+8 are *demonstrated* in this build  -  see `docs/FEATURES.md`
§17.)
