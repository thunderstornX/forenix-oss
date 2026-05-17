# Security + Threat Model  -  forenix-oss

> "Forensic chain-of-custody" is a marketing word until you can
> prove it cryptographically. This document documents the proof.

## 1. Assets

| # | Asset | Sensitivity |
|---|---|---|
| A1 | Audit log (hash chain) | **Critical**  -  invalidating it breaks the entire product claim |
| A2 | Evidence rows + commit history | **High**  -  the case stands or falls on this |
| A3 | Investigation findings | **Medium**  -  pre-evidence, but still confidential to the analyst |
| A4 | User credentials | **High**  -  controls all of the above |
| A5 | LLM API keys | **High**  -  billing risk + can be used to attribute LLM output |
| A6 | LLM provider responses | **Low-Medium**  -  raw model output, not verified |

## 2. Threat model (STRIDE)

| Threat | Category | Example | Mitigation |
|---|---|---|---|
| Audit-log tampering | **Tampering** | Adversary edits a row to hide an action | SHA-256 forward chain; any edit breaks the chain at the next replay |
| Reordering of audit rows | **Tampering** | Adversary swaps two rows to suggest a different timeline | `createdAt` is a chain input -> reordering breaks hash recomputation |
| Hash-truncation collision attack | **Tampering** | Attacker produces a benign row hash that collides with a sealed row | Full 256-bit hash stored; UI truncates *display* only |
| Evidence forging | **Tampering** | Adversary inserts an Evidence row from outside the API | All writes go through routes that audit-log; out-of-band inserts surface as audit-gap rows |
| Adapter MITM | **Tampering** | Adversary intercepts an LLM API call | HTTPS only; pinned adapter base URLs; document SHA-256 of model output in the audit row |
| Replay attack on POST | **Spoofing** | Adversary replays a "promote_finding" request | Per-finding `evidenceId` is checked  -  already-promoted findings return 409 |
| Credential theft | **Spoofing** | Adversary obtains a user's session | Session cookies are httpOnly + secure; SaaS tier adds optional SSO + MFA |
| Adapter env leak | **Information disclosure** | Adversary reads `.env` | `.env` is gitignored; secrets handed in via env at run time |
| LLM key reuse | **Information disclosure** | Forensic exports include the API key by accident | API keys are never emitted in any response or log line |
| LLM hallucination poisoning | **Repudiation** | Model invents a "finding" that gets promoted to evidence | Findings carry `confidence` + `reasoningTrace` + source URLs; verification view forces ratification |
| DoS via giant pipeline body | **Denial of service** | Adversary POSTs a massive `agentGroups` array | Body Zod-validated; agent-group enum capped at 7 values |
| DoS via long LLM hang | **Denial of service** | Provider stalls indefinitely | Adapter requests have a 90 s AbortController timeout |
| Privilege escalation | **Elevation of privilege** | Investigator edits an admin-only field | RBAC ships in the SaaS premium tier; OSS tier treats all users as one role with the disclaimer documented |

## 3. Audit chain  -  formal spec

```
GENESIS = sha256_zero = 0x0000...0000 (32 bytes, hex-encoded)

hash(row_n) =
    sha256(
        hash(row_{n-1})                   -- prev
      | "|" | row_n.action                -- separator + verb
      | "|" | row_n.entity                -- model name
      | "|" | row_n.entityId              -- target row id ("" if null)
      | "|" | row_n.createdAt.toISOString()
    )

invariants:
    row_n.prevHash == hash(row_{n-1})
    row_n.hash     == hash(row_n)
```

Implementation: `src/lib/audit-chain.ts:computeAuditHash`.
Verification: `src/lib/audit.ts:verifyAuditChain`.
UI surface: `/integrity` view.

### 3.1 What the chain attests

- **No row deletion** without detection (the next row's `prevHash`
  would no longer match the deleted row's `hash`).
- **No row mutation** without detection (the row's own `hash`
  would no longer match its recomputed value).
- **No silent reordering** (timestamps are part of the input).

### 3.2 What the chain does **not** attest

- **Authorship.** The chain proves *that* an action happened, not
  *who* performed it. Authorship comes from authentication +
  RBAC, which is layered on top.
- **Causality.** Two rows with close timestamps are independent  - 
  the chain doesn't prove one caused the other.
- **Truthfulness of content.** A row faithfully records that
  "promote_finding_to_evidence was invoked"; it does not assert
  that the finding itself is true.

### 3.3 Verifying the chain offline

```bash
# Dump the audit table (Postgres example)
psql $DATABASE_URL -c "
  COPY (SELECT id, action, entity, COALESCE(\"entityId\",''),
               hash, \"prevHash\", \"createdAt\"
        FROM \"AuditLog\" ORDER BY \"createdAt\" ASC) TO STDOUT
       CSV HEADER
" > audit.csv

# Replay in a few lines of Python
python3 <<'PY'
import csv, hashlib
GENESIS = "0" * 64
prev = GENESIS
with open("audit.csv") as f:
    for r in csv.DictReader(f):
        h = hashlib.sha256()
        for part in (prev, r["action"], r["entity"],
                     r["coalesce"], r["createdAt"]):
            h.update(part.encode("utf-8")); h.update(b"|")
        # strip trailing separator and re-do without it:
        h = hashlib.sha256("|".join([
            prev, r["action"], r["entity"], r["coalesce"], r["createdAt"]
        ]).encode("utf-8")).hexdigest()
        assert r["prevHash"] == prev and r["hash"] == h, f"BROKEN at {r['id']}"
        prev = r["hash"]
print("chain OK")
PY
```

## 4. Defense-in-depth

| Layer | Control | File |
|---|---|---|
| Network | HTTPS only in prod (Cloudflare + ALB) | infra |
| Transport | HSTS, secure cookies | `src/app/layout.tsx` (planned) |
| Application | Zod validation on every mutating route | `src/app/api/**/route.ts` |
| Application | `server-only` marker on every server module | `src/lib/{db,audit,ai}.ts` |
| Application | Adapter factory never falls through to paid | `src/lib/ai/adapter.ts` |
| Application | Adapter calls timeout (AbortController) | `src/lib/ai/chat-completions.ts` |
| Persistence | SHA-256 audit chain | `src/lib/audit-chain.ts` |
| Persistence | Cascade-on-delete from parent | `prisma/schema.prisma` |
| Build | TypeScript strict | `tsconfig.json` |
| Build | ESLint flat config | `eslint.config.mjs` |

## 5. Sensitive data handling

- **PII.** Findings + entities frequently contain PII (names,
  addresses, phone numbers). The schema does not encrypt these at
  rest; deployment-level disk encryption is required for any
  regulated environment.
- **API keys.** Live only in `.env` (gitignored) and in process
  memory. Never logged. Never echoed in any HTTP response. Never
  embedded in screenshots or PDF exports.
- **Evidence bytes (Phase 8).** When the file-bytes feature ships,
  the bytes themselves live in S3 (or local object storage)
  encrypted server-side; the database holds only the SHA-256.

## 6. Backups + recovery

- **Postgres**  -  PITR + WAL streaming (RPO <= 5 min).
- **SQLite**  -  daily backups + the user is responsible for
  rotation.
- **Audit chain**  -  the same `audit` table backup carries the
  chain proof. Restoring an earlier snapshot truncates the chain
  but does not invalidate it.
- **Verification after restore**  -  run `GET /api/audit/verify`
  immediately after restore; the chain should return `ok: true`
  with the appropriate `entries` count.

## 7. Compliance posture

> Compliance is *jurisdiction-specific*; the following items are
> design choices that make compliance attainable, not
> certifications.

- **ISO 27001**  -  append-only audit + RBAC (SaaS) + DR plan +
  documented incident response are all aligned with Annex A.
- **GDPR / UK GDPR**  -  single-tenant deployment + per-row deletion
  via Prisma is straightforward; the audit chain remains intact
  on delete because deletes are themselves audit rows.
- **NIST 800-53**  -  AU-9 (Protection of Audit Information),
  AU-10 (Non-Repudiation), CM-6 (Configuration Settings) are
  directly served by the chain + the `SAAS_MODE` flag.
- **eDiscovery (FRCP)**  -  exported reports + the audit-chain
  attestation jointly support custodial-chain admissibility.

## 8. Reporting a vulnerability

For now, open a private GitHub Security Advisory on
`thunderstornX/forenix-oss`. A formal `SECURITY.md` with PGP key
ships in the next release.
