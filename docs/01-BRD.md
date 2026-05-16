# Business Requirements Document — forenix-oss

| Field | Value |
|---|---|
| Document | Business Requirements Document (BRD) |
| Product | forenix-oss |
| Version | 0.1 (Phase 1 + Phase 2 complete) |
| Date | 2026-05 |
| Author | Ali Murtaza Bhutto |
| Status | Draft for funding round / pilot recruitment |

## 1. Executive summary

Investigations involving public-source intelligence (OSINT) and the
forensic preservation of evidence are routinely conducted in two
disconnected toolchains. OSINT analysts use Maltego, SpiderFoot,
Hunchly and bespoke Python pipelines. Forensic examiners use
EnCase, AXIOM, Cellebrite Reader, and case-management systems like
Relativity. The handoff between the two — *"I found something on
the open web that looks evidentiary, now what?"* — is manual,
fragile, and rarely audit-grade.

**forenix-oss** is one platform that owns both halves of that
journey. It runs the OSINT pipeline, captures the findings, and
turns them into forensic evidence with full Git-style chain-of-
custody — every change hash-chained, every action audited, every
piece of evidence promotable directly from the source finding.

## 2. Business objectives

| # | Objective | Success metric (12 months) |
|---|---|---|
| O1 | Cut the OSINT→forensics handoff from days to clicks | < 60s from finding to admissible evidence row in 90% of cases |
| O2 | Make chain-of-custody verification trivial | One-button replay of any audit log up to 10M rows; < 5s |
| O3 | Lower the price floor for serious investigators | Free OSS tier covers every analyst feature; SaaS tier $99–$499/seat/mo |
| O4 | Make the audit trail attestable | Cryptographic chain readable + verifiable by a third party (court, IGO, journalist) |

## 3. Target users + personas

### Primary — Analyst / Investigator
- Boutique OSINT shops (Bellingcat-style), corporate threat-intel
  teams, fraud investigators, due-diligence consultancies, journalist
  collectives.
- Needs: low setup cost, scriptable, runs offline, exports clean
  artefacts.

### Primary — Forensic examiner
- Inside an incident-response firm, an MSSP, or a public agency.
- Needs: chain-of-custody, court-admissibility, multi-reviewer
  approval, immutable audit.

### Secondary — Counsel
- Outside counsel and in-house legal who consume forensic reports.
- Needs: read-only export, attestable integrity.

### Secondary — Compliance / Audit officer
- Reviews investigations after the fact for procedural conformance.
- Needs: replay, search, attestation.

## 4. In-scope functional requirements

| ID | Requirement | Phase |
|---|---|---|
| FR-01 | Create investigations with target, target type, agent groups, objective | 1 ✅ |
| FR-02 | Run a configurable OSINT pipeline driven by an AI adapter | 1+3 ✅ |
| FR-03 | Persist findings with confidence, priority, source, reasoning trace | 1 ✅ |
| FR-04 | Auto-extract entities + relations from findings | 3 ✅ |
| FR-05 | Promote a finding to forensic evidence in one click | 2 ✅ |
| FR-06 | Bridge an investigation to a forensic case | 2 ✅ |
| FR-07 | Evidence with Git-style branches + commits | 1 ✅ |
| FR-08 | Hash-chained audit log across both workflows | 1 ✅ |
| FR-09 | Integrity verification: replay the chain, surface tampering | 1 ✅ |
| FR-10 | Pluggable AI adapter (mock / local / hosted / sovereign / SaaS-paid) | 1+7 ✅ |
| FR-11 | Cross-case knowledge graph | 5 ✅ |
| FR-12 | Reports (sectioned JSON + markdown) | 6 ✅ |
| FR-13 | AI Lab — visibility into agent input/output/confidence | 6 ✅ |
| FR-14 | Monitors — scheduled re-runs (record-only in 0.1) | 6 ✅ |
| FR-15 | Verification — claim-level verdicts | 6 ✅ |
| FR-16 | Merge-request reviews on evidence branches | 4 ✅ (data + list view) |
| FR-17 | Command palette ⌘K | this pass ✅ |
| FR-18 | Background scheduler for Monitors | 7 (not yet) |
| FR-19 | Real bytes-on-disk evidence + S3 / IPFS storage | 8 (not yet) |
| FR-20 | PDF report export (SaaS premium) | 8 (not yet) |
| FR-21 | Organisation multi-tenancy + RBAC (SaaS premium) | 8 (not yet) |

## 5. Non-functional requirements

| ID | NFR | Target |
|---|---|---|
| NFR-01 | Local-first | Full single-tenant install runs offline with the `mock` adapter |
| NFR-02 | Adapter freedom | No vendor lock — six adapters; swap with one env var |
| NFR-03 | Audit-chain integrity | SHA-256 forward-chain on every write; broken chain surfaced in UI |
| NFR-04 | Reproducibility | One-command seed produces a complete demo |
| NFR-05 | Type safety | TypeScript strict + zero TS errors on CI |
| NFR-06 | Security gates | bandit-equiv + dep audits clean on Python sources, hadolint clean on Dockerfiles (when added), API routes Zod-validated |
| NFR-07 | Latency budget (mock) | < 200 ms p95 for list endpoints on commodity hardware |
| NFR-08 | Latency budget (real LLM) | Pipeline run completes within 90 s on free-tier hosted models |

## 6. Out of scope (0.1)

- Mobile native applications.
- Real-time multi-user collaborative editing.
- Built-in dark-web crawler (we leave dark-web sourcing to dedicated
  upstream tools; forenix-oss ingests their output).
- Native KYC / sanction-list integrations (planned as SaaS premium).
- Multi-region replication (single instance ships; deployments can
  bring their own Postgres replication).

## 7. Open-source / commercial split

| Tier | Distribution | Includes |
|---|---|---|
| **Core (MIT)** | self-host, Docker, the GitHub repo | every analyst feature, every adapter except Claude, mock + Ollama + GLM + OpenRouter + NVIDIA, audit-chain, branch-graph, integrity verifier |
| **SaaS Premium** | hosted at forenix-oss.com | ClaudeAdapter, advanced OSINT sources (Shodan/Censys/Hunter), PDF export, multi-tenant org isolation, SSO, usage metering, support |

Gate logic is a single env var (`SAAS_MODE=true`); premium features
are additive, never restrictive — the core feature paths must work
identically whether SAAS_MODE is set or not.

## 8. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Forensic acceptance — courts dispute audit-chain methodology | low | high | Publish the cryptographic spec; commission a third-party audit pre-GA |
| LLM hallucination poisons cases | medium | high | Every finding carries its raw source URLs; verification view forces human ratification before promotion to evidence |
| Adapter API churn (OpenRouter, NVIDIA) | medium | medium | All adapters share a single 4-method interface; new providers are 1-file drop-ins |
| Single-tenant assumption blocks SaaS growth | medium | medium | Postgres schema is already structured to take an `orgId` discriminator — adding tenant isolation is migration-only, not a rewrite |
| Open-source vs. commercial line gets fuzzy | medium | medium | `SAAS_MODE` is the *only* gate; everything else is MIT |

## 9. Success criteria (12-month plan)

- 50 self-hosted production deployments.
- 10 design-partner cases through SaaS.
- 1 third-party cryptographic audit of the chain.
- 1 published court-admissible export workflow.
- 3 community adapters submitted by external contributors.
