# forenix-oss — one-pager

**OSINT × Forensics, one workflow.**

The first open-source platform that turns public-source intelligence
into court-admissible evidence — with a cryptographic chain of
custody from the first finding to the final verdict.

| | |
|---|---|
| **Stage** | YC-applicant · Pre-seed |
| **Status** | Working MVP · live LLMs · 15 views shipped |
| **License** | MIT (core) + commercial SaaS premium |
| **Founder** | Ali Murtaza Bhutto · alibhutto101112@gmail.com |
| **Repo** | https://github.com/thunderstornX/forenix-oss |

## The problem

Investigations that mix public-source intelligence with forensic
evidence run on two disconnected toolchains — Maltego / SpiderFoot
on one side, EnCase / Cellebrite on the other. The handoff is
manual, the chain of custody is artisanal, and the audit trail
doesn't survive a court challenge.

## The product

One web app owns the full journey:

1. **Run** an AI-driven OSINT pipeline (seven agent groups, any LLM
   provider).
2. **Capture** findings with confidence, source URLs, reasoning
   trace.
3. **Bridge** any finding into a forensic case in one click —
   evidence gets a SHA-256 hash + an initial commit on its own
   branch.
4. **Lock** the chain — every state change appends a SHA-256
   forward-chained audit row; one button replays the whole chain
   to attest integrity.
5. **Sign-off + export** — merge-request reviews on evidence
   branches; markdown + PDF reports.

## Why now

- Hosted LLMs (NVIDIA NIM, OpenRouter, Zhipu GLM, local Ollama)
  bring 70B-class quality to $5/mo budgets — per-investigator AI
  pipelines are finally viable.
- Open-source investigative work is appearing in ICC and national
  court filings. The data has admissibility. The custody process
  doesn't. Yet.
- Open-source forensics is having a moment (Velociraptor, Hayabusa,
  OpenCTI, MISP) but the OSINT+forensics bridge is missing.

## Traction (today)

- **6 AI adapters** shipped — Mock, Ollama, GLM, Claude, OpenRouter,
  NVIDIA.
- **End-to-end live runs** demonstrated through NVIDIA Llama-3.3-70B
  (47 s, 11 findings) and OpenRouter `gpt-oss-120b:free` (82 s,
  10 findings → bridged → 13 evidence rows).
- **Audit chain proven** — `verifyAuditChain()` green at 19 entries
  after the full demo cycle.
- **15 production views** — Dashboard, Investigations, Pipeline,
  Cases, Evidence, Branch graph, Entity graph, Network graph,
  Monitors, Verification, AI Lab, Reports, Reviews, Audit,
  Integrity.
- **Document pack** — BRD, SRS, SDS, DFD, Deployment plan,
  Architecture ADRs, Threat model, API reference, Runbook.

## Business model

| Tier | Price | Audience |
|---|---|---|
| Core (MIT) | $0 | Self-hosted users · Bellingcat-style shops · journalists · NGOs |
| Team | $99/seat/mo | Boutique investigative firms · MSSP IR teams |
| SaaS Premium | $499/seat/mo | Multi-tenant orgs needing SSO + PDF + Shodan/Censys + Claude |
| Enterprise | Annual | Air-gapped + custom adapters + SOC2 |

## Ask

**$500K SAFE @ $10M post-cap.** Buys 18 months of runway. Drives:

- Q3 2026: Docker-compose deploy + first 50 production self-hosts.
- Q4 2026: PDF export · multi-tenant orgs · ClaudeAdapter live.
- Q1 2027: Third-party cryptographic audit of the chain.
- Q2 2027: First 10 paying Team-tier customers · $30K MRR.
- Q3 2027: First 3 SaaS-premium pilots · $100K ARR.

## Why us

- Solo founder, 15+ shipped OSS security tools (github.com/thunderstornX).
- Certifications: CEH V13, CHFI, CNSP, CAP V2, ISO 27001 Associate,
  Anthropic Prompt-Engineering + Agentic Workflows, NVIDIA DLI RAG.
- 3 published research papers on Zenodo · ORCID 0009-0007-2787-943X.
