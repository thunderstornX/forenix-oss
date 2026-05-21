# Replication guide

This guide gets a researcher from a fresh git clone to a working
local instance of forenix-oss with seeded data, plus a replayed
case study, in approximately ten minutes on a developer laptop.

It is the inspection-oriented companion to the deployment-oriented
[`docs/OSS_INSTALL.md`](../OSS_INSTALL.md) and
[`docs/05-DEPLOYMENT.md`](../05-DEPLOYMENT.md). Use this guide if
you want to verify the empirical claims in
[`../../RESEARCH.md`](../../RESEARCH.md) or in the case studies
documented in [`case-studies.md`](case-studies.md).

---

## 1. Prerequisites

- A Unix-like environment (macOS, Linux, WSL2 on Windows)
- [Bun](https://bun.sh) v1.3 or later (the project's runtime)
- Git
- Approximately 600 MB of free disk space for the dependency tree
  and the seeded SQLite database

No Postgres is required for the replication path; the project's
SQLite schema (`prisma/schema.prisma`) is byte-for-byte equivalent
to the Postgres production schema (`prisma/schema.postgres.prisma`)
in everything that affects the empirical claims.

No API keys are required for the baseline replication. The mock
LLM adapter and the deterministic Git fallback both run without
external network calls. If you wish to replay a case study against
a real LLM, you will need a key from one of the free-tier providers
listed in [`../../README.md`](../../README.md) (OpenRouter, Groq,
NVIDIA NIM, and self-hosted Ollama all have viable free or
free-trial pathways).

---

## 2. Clone, install, seed

```bash
git clone https://github.com/thunderstornX/forenix-oss.git
cd forenix-oss
bun install
cp .env.example .env
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env
bun run db:push
bun run db:seed
```

The seeded database includes four users (one per role), a demo
team, three seeded investigations with paired findings, two open
forensic cases with branched evidence, and ten audit-log entries
that exercise the SHA-256 chain.

---

## 3. Run

```bash
bun run dev
```

Open `http://localhost:3000`, click *Sign in*, and use the
credentials printed by the seed script
(`admin@forenix-oss.local` / `forenix` is the default admin).

The dashboard should show non-zero counts across investigations,
cases, evidence items, and monitors. If any count is zero, the
seed did not run; re-run `bun run db:seed` and refresh.

---

## 4. Verify the audit chain

The audit chain is the central security claim. Two ways to check
it without trusting the platform's UI:

```bash
# Option A: run the bundled verifier (recomputes every row's hash
# from the previous row's hash + the row content)
bun run scripts/verify-audit-chain.ts

# Option B: export the chain as JSON, verify it offline with any
# language / tool you trust more than this codebase
bun run scripts/dump-audit-log.ts > /tmp/audit.json
```

The bundled verifier imports `computeAuditHash` and `GENESIS_HASH`
from `src/lib/audit-chain.ts`. That module is intentionally pure
(no Prisma, no `server-only` marker) so the same primitive the
platform writes with is the primitive the script verifies with.

For full independence from the project's TypeScript code,
[`docs/07-SECURITY.md`](../07-SECURITY.md) section 4 reimplements
the SHA-256 forward chain in twelve lines of Python that you can
run against the JSON dump.

---

## 5. Replay a case study

The case studies documented in [`case-studies.md`](case-studies.md)
were run on a deployed instance with a real LLM adapter. To
replay one locally on the mock adapter:

```bash
# Bootstrap a new investigation against the same target
bun run scripts/init.ts \
  --target "sigstore.dev" \
  --type "domain" \
  --objective "transparency-log and signing-infrastructure footprint"

# The script prints the investigation id; use it below:
INV=<id_from_above>

# Run the pipeline (mock adapter; substitute AI_ADAPTER=openrouter
# and OPENROUTER_API_KEY=... for real-LLM replay)
curl -s -X POST -H "Content-Type: application/json" \
  -b "$(cat .auth-cookie)" \
  http://localhost:3000/api/pipeline/run/$INV
```

The mock-adapter replay will not produce the same findings as the
real-LLM run reported in `case-studies.md`. It will, however,
produce the same shape of data (findings, entities, relations,
report), exercise the same code paths, and write the same audit
trail. That is sufficient to verify the apparatus.

For comparison against the live case-study artefacts, the rendered
PDF reports are committed at:

- [`case-studies/sigstore-case.pdf`](case-studies/sigstore-case.pdf)
- [`case-studies/archive-org-case.pdf`](case-studies/archive-org-case.pdf)

---

## 6. Replay an attestation

The attestation system has three backends; the local HMAC backend
needs no external network. To verify it round-trips:

```bash
# Run the unit test suite for attestation
bun test src/lib/attestation/

# Or interactively: create an attestation, verify it
bun --eval '...'  # see docs/07-SECURITY.md section 6 for an interactive recipe
```

The GitHub-issue and Sigstore-Rekor backends require external
network and credentials. Configurations are documented in
[`docs/07-SECURITY.md`](../07-SECURITY.md) section 6 and exercised
in `src/lib/attestation/backends/github.test.ts` and
`rekor.test.ts` under recorded-fixture mode.

---

## 7. Run the test suite

```bash
bun test
```

Ten test files; the security-critical paths (audit chain, evidence
store, security helpers, monitor-scheduler cadence, event bus,
attestation backends, AI chat-completions, git engine) all carry
explicit tests. Coverage on infrastructure modules (DB wrapper,
adapter factory, hook layer) is intentionally sparser.

---

## 8. What to do next

- Read [`../../RESEARCH.md`](../../RESEARCH.md) for the research
  framing the platform was designed to enable.
- Read [`research-questions.md`](research-questions.md) for the
  four open empirical questions each with literature-gap framing.
- Read [`case-studies.md`](case-studies.md) for the methodology
  and findings of the two case studies run against the deployed
  instance.
- Read [`ethics.md`](ethics.md) before running the platform
  against any target you do not have authorisation to investigate.

If you intend to use the platform as the apparatus for an
empirical research programme, the maintainer welcomes
correspondence via repository issue or the contact methods in
[`../../README.md`](../../README.md).
