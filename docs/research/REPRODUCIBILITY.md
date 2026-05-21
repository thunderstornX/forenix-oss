# Reproducibility checklist

A concise checklist of the conditions under which the empirical
claims in [`case-studies.md`](case-studies.md) and elsewhere can
be reproduced. Adapted from the NeurIPS / PRIME reproducibility
checklists for software-artefact research.

| Item | Status |
|---|---|
| **Source code available** | Yes, MIT-licensed, this repository |
| **Tagged release for the work cited** | Yes, `v0.5.4` and forward; older tags at [`https://github.com/thunderstornX/forenix-oss/releases`](https://github.com/thunderstornX/forenix-oss/releases) |
| **Permanent archival identifier (DOI)** | Pending: Zenodo deposit via GitHub integration; DOI recorded in `CITATION.cff` once minted |
| **Dependency versions pinned** | Yes, `bun.lock` (Bun lockfile) committed |
| **Database schema versioned** | Yes, Prisma migration history under `prisma/`, dual schemas for SQLite (dev) and Postgres (prod) |
| **Seed data committed** | Yes, `prisma/seed.ts`; seeded SQLite DB is deterministic from a clean state |
| **Reference deployment available** | Yes, [demo.forenix.tech](https://demo.forenix.tech) (invite-only) |
| **Local-replay path** | Yes, [`REPLICATION.md`](REPLICATION.md). Clone to running platform in ~10 minutes |
| **Random-seed control** | Mock adapter is deterministic. Real-LLM adapters (openrouter, groq, nvidia, ollama, glm) are not. Replication runs against a real-LLM adapter will exercise the same code paths but produce different outputs run to run. |
| **Hardware requirements** | Any modern developer laptop. No GPU required for the platform itself; the deep subprocess OSINT toolchain requires a Unix-like host with the binaries installed |
| **Wallclock cost per case study** | ~3 minutes pipeline runtime per investigation against the model recorded in [`case-studies.md`](case-studies.md). PDF render adds ~10 seconds. Total elapsed including the bridge-to-case step: under 5 minutes. |
| **Approximate financial cost per case study** | Zero on the mock or self-hosted adapters; for the `openai/gpt-oss-120b:free` model on OpenRouter used in the committed case studies, no cost per call within the free tier's rate limit |
| **Test suite** | Yes, `bun test` runs ten test files covering the security-critical paths |
| **Continuous integration** | Yes, `.github/workflows/ci.yml` runs the suite on push |
| **Configuration committed** | Yes, `.env.example` documents every recognised variable; the model and adapter used per case study are stated explicitly in `case-studies.md` |
| **Raw structured data for committed case studies** | Yes, JSON exports under `case-studies/` alongside the rendered PDFs |
| **Audit-chain verifier** | Yes, `scripts/verify-audit-chain.ts`; independent Python recipe in `docs/07-SECURITY.md` section 4 |
| **Pre-registration** | Not yet. The intent for any substantive empirical study running on the platform is to pre-register the protocol and the analysis plan (OSF or equivalent) before the first run; see [`../../RESEARCH.md`](../../RESEARCH.md) section 10. |
| **Ethics review** | Project-internal posture documented in [`ethics.md`](ethics.md). Formal IRB review is the operator's responsibility for any study that processes human-subject data; the platform does not perform this review on the operator's behalf. |
| **Conflict-of-interest statement** | [`../../RESEARCH.md`](../../RESEARCH.md) section 11 |
| **Funding statement** | [`../../RESEARCH.md`](../../RESEARCH.md) section 11 |

## What to do if a claim does not reproduce

If a measurement or behaviour described in [`case-studies.md`](case-studies.md),
[`../../RESEARCH.md`](../../RESEARCH.md), or any other research
document in this tree does not reproduce on a clean clone at the
recorded tag, please open a repository issue with:

- The exact tag or commit SHA you ran against
- The adapter and model you used (and key tier, if relevant)
- The exact command sequence you ran
- The output you observed vs the output the document claims
- Your environment (OS, Bun version, Node version if relevant,
  database backend)

Reproducibility failures are not embarrassing; they are how the
artefact gets stronger. They will be triaged with priority over
new features.
