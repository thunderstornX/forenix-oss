# Changelog

All notable changes to forenix-oss are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

Operational rigidity pass — closes the structural gaps behind the
v0.5.6 deploy incident and hardens the paid surface against data loss.

### Added

- **Automated droplet backups.** A nightly systemd timer
  (`forenix-backup.timer`, 03:30 UTC, `Persistent=true`) runs
  `/usr/local/sbin/forenix-backup.sh`: `pg_dump -Fc` of the Postgres
  DB, a tar of the evidence store, and a copy of `.env`, rotated to
  the newest 14 of each under `/var/backups/forenix/`. Installed
  out-of-tree so the deploy `rsync --delete` cannot remove it. The
  deploy script also fires it once right before every schema push, so
  each deploy has an immediate restore point. Restore procedure in
  RUNBOOK §15.
- **Postgres-client typecheck in CI** (`postgres-typecheck` job).
  Regenerates the Prisma client from the Postgres deploy schema and
  typechecks against it — the *semantic* counterpart to the textual
  schema-parity diff. Catches the v0.5.6 class (a relation/field in
  one schema but not the Postgres client) on the PR, not late on the
  droplet.
- **Pre-flight typecheck in the deploy workflow.** The assembled tree
  (OSS Core + private overlay) is typechecked against the Postgres
  client on the runner *before* the rsync, so a broken build never
  reaches the droplet.
- **Deploy provenance.** `/api/health` now reports `commit` + `builtAt`,
  read from a `.revision` file the deploy workflow stamps with the
  exact OSS SHA — replacing the on-droplet `.git`, which froze at first
  setup and reported a wrong SHA.

### Changed

- **Deploy is now gated on CI.** `deploy-droplet.yml` triggers via
  `workflow_run` after CI succeeds on `main` (was: `push` to `main`,
  racing CI in parallel). A red build no longer reaches the paid
  surface. `workflow_dispatch` remains for ad-hoc redeploys.
- **`prisma db push` in the deploy path no longer passes
  `--accept-data-loss`.** A destructive schema change now aborts the
  deploy (prod stays on the previous version) instead of silently
  executing against customer data; an operator applies it deliberately
  by hand after confirming the snapshot.

### Added

- **SatTrace validation.** Structured `reasoningTrace` objects returned
  by the model are now validated + normalised before storage
  (`src/lib/ai/sat-trace.ts`): `technique` must be a known SAT (an
  unknown one flags the trace), `weight` is clamped to 0..1,
  `credibility` to 1..5, and `selected` into the candidate range. A
  structurally-broken trace is stored as an explicit `_invalidSatTrace`
  marker — which the Verification view now surfaces ("⚠ reasoning trace
  failed validation") instead of silently rendering nothing. Free-text
  legacy traces still pass through. Adds `sat-trace.test.ts`.
- **README**: open-issues badge.

### Security

- **OSINT subprocesses now run with a minimal environment.** The tool
  runner (`spawnTool`) previously inherited the full app environment,
  so every spawned CLI saw `OPENROUTER_API_KEY`, `AUTH_SECRET`,
  `DATABASE_URL`, etc. It now passes only `PATH`/`HOME`/locale/`TMPDIR`
  plus any key a tool explicitly opts into — no app secrets reach
  third-party binaries.
- **dnsx no longer shells out.** It built a `sh -c 'echo … | dnsx …'`
  pipe with the (validated) domain interpolated in; replaced with a
  direct spawn that feeds the domain over stdin (`spawnTool` gained an
  `input` option). No shell, no interpolation, nothing to inject into
  even if the validator were ever loosened.
- **Positional-arg validators forbid a leading dash.** `sherlock`,
  `maigret`, and `holehe` pass the LLM-supplied handle/address as a
  positional argv; their validators now require an alphanumeric/`_`
  first character so a `-`/`--flag`-shaped value can't be parsed as a
  CLI option. Added `runner.test.ts` covering all of the above.

### Fixed

- **Vercel preview deployments.** `vercel-build` moved to
  `scripts/vercel-build.sh`, which runs `prisma db push` + seed only
  when `VERCEL_ENV=production`. Preview/development builds (which have
  no provisioned database) now generate the client and build instead
  of failing at `prisma db push` with `DATABASE_URL not found`. An
  isolated Preview environment (mock adapter, fresh secrets,
  placeholder DB, no waitlist-sync) backs it.

## [0.5.7] - 2026-05-26

Closes the v0.5 line. Adds a CI safety net that would have caught
the v0.5.6 Deploy SaaS failure before it hit the droplet, an
investigated-and-documented Turbopack warning, and a contributing
note covering the test preload + two-schema rule.

### Added

- **CI schema-parity step**: `ci.yml` now strips comments + blank
  lines from the `model` blocks of `schema.prisma` and
  `schema.postgres.prisma`, then diffs them. The build fails with
  a clear message if the SQLite dev schema and the Postgres
  deploy schema drift. Catches the exact class of bug that broke
  Deploy SaaS on v0.5.6 (the `Verification.investigation`
  relation was added to the SQLite schema only; the droplet
  build failed at tsc time because the generated Postgres client
  did not know about it).
- **Contributing section notes** in the README: the two-schema
  rule and the role of `bunfig.toml` + `test/setup.ts` (server-only
  neutralisation for the test runner).

### Fixed

- **Postgres `Verification.investigation` relation** (commit
  `1e1e868`, also in this release): mirrors the SQLite-side
  addition from v0.5.5. The droplet Deploy SaaS build now passes
  in 2m26s (was failing at tsc).

### Investigated, documented as known-benign

- **Turbopack "Encountered unexpected file in NFT list" warning**
  on `src/lib/evidence-store.ts`. Tried inline `turbopackIgnore`
  hints and an env-var indirection; neither silences it. The
  warning is informational, the build completes, and the route
  works in production. Comment in the source file points future
  contributors at the working theory so nobody else burns time
  on it.

### Notes

- 119/119 tests passing. Typecheck, lint, build clean.
- This release also serves as the close marker for the v0.5 line.
  The multi-tenant correctness sweep that began in v0.5.1
  (schema), continued through v0.5.5 (helpers + bridge test) and
  v0.5.6 (route sweep + demo visitor isolation), and ends here
  (CI safety net), is now structurally complete.

## [0.5.6] - 2026-05-26

Completes the multi-tenant correctness sweep from v0.5.5. Every
remaining auth-only route that touches tenant data now goes
through a scope check; the demo visitor can no longer accidentally
inherit a real tenant's scope; documentation and roadmap catch up
with the work that actually shipped.

### Security

- **Scope checks on the remaining nine routes** that v0.5.5 left
  as auth-only. Each now returns 404 (not 403) on out-of-scope
  access so existence is not disclosed across tenants:
  - `audit` GET — filters AuditLog through parent case/investigation
  - `monitors` GET, POST, PATCH, DELETE, run — scoped via parent
    Investigation; POST validates body `investigationId` is in scope
  - `reviews/[id]/merge` — scoped via parent Case
  - `verifications/[id]` PATCH — scoped via parent Investigation
- **Demo visitor isolation (Tier A3).** When any Organization
  exists on the deployment, `/api/demo/try` auto-provisions a
  dedicated `demo` org + team and pins the visitor to it, so
  visitor reads can never bleed into real tenants. OSS / Vercel
  concept deployments with no orgs configured still get the
  existing "join every team" behaviour for browsing seeded data.
- **Documented exemptions.** `attestation` (deployment-global
  audit-chain witnesses) and `agent-tasks/[id]` (Agent registry
  is global; per-tenant execution is v0.6+ schema work) carry
  explicit comments explaining why they remain unscoped.

### Added

- **`docs/FEATURES.md` section 18** — full multi-tenant model:
  scope matrix, helper inventory, intentional global exemptions,
  demo-visitor isolation behaviour.
- **Five new bridge test cases** in `src/lib/rbac.test.ts`:
  Monitor list / by-id scope, Verification write scope, AuditLog
  list scope via parent Case OR Investigation. Now 19 tests
  total.

### Fixed

- **README roadmap drift.** Phase 9.5 (Multi-tenant org isolation)
  was still marked open even though it shipped across v0.5.1
  through v0.5.6. Flipped to checked with the actual version
  range.

### Notes

- 119/119 tests passing (was 114; +5 from the v0.5.6 sweep).
- Typecheck clean, lint clean, build green.

## [0.5.5] - 2026-05-24

Multi-tenant correctness sweep (carried-forward Tier A2 + A4).
Closes the team-isolation gaps left after the v0.5.3 partial
scope work. Every API route that reads, writes, or lists
tenant-bearing data now goes through a scope check; a new
cross-team bridge isolation test exercises the helpers against
a real SQLite fixture so regressions are caught at test time.

### Security

- **Closed eleven cross-tenant data-exposure paths.** Routes
  that previously returned (or wrote) data without checking the
  actor's team or org now go through new scope helpers and
  return 404 on out-of-scope access. Affected routes:
  `cases/[id]` GET, `investigations/[id]` GET,
  `evidence/[id]/{download,seal,verify-bytes}`,
  `evidence/upload`, `findings/[id]/{promote,verify}`,
  `bridge/inv-to-case/[id]`, `reports`, `reports/[id]`. The
  404 (not 403) disclosure choice prevents existence-leaks
  across tenants.
- **List-route scope sweep.** `entities`, `verifications`,
  `reviews`, and `network` now filter through the parent
  Case / Investigation that carries `teamId` and `orgId`.
- **`investigations/init` body-supplied teamId is validated**
  against the actor's team memberships; out-of-scope teamIds
  return 403. The actor's `orgId` is now propagated onto
  every new investigation (was previously left NULL).

### Added

- **`src/lib/rbac.ts` scope helpers**: `requireCaseInScope`,
  `requireInvestigationInScope`, `requireEvidenceInScope`,
  `requireFindingInScope`, `requireReportInScope`. Each
  returns the row when the actor can see it and throws
  `HttpError(404)` otherwise. Designed to be a one-liner
  retrofit for any route that takes a tenant-bearing path
  parameter.
- **`src/lib/rbac.test.ts`**: 14-test cross-team bridge
  isolation suite. Spins up a fresh SQLite DB in `/tmp`,
  pushes the live Prisma schema, seeds two orgs / teams /
  users / cases / investigations / evidence / findings /
  reports, then verifies the scope matrix end-to-end. Covers
  `teamScopeWhere` directly plus all five resource-level
  scope helpers across operator, org-admin, and per-team
  analyst roles.
- **`test/setup.ts` + `bunfig.toml`** preload that
  neutralises the `server-only` marker so tests can import
  `rbac.ts` / `db.ts` without the Client Component throw.

### Schema

- `Verification.investigation` relation declared (and matching
  `Investigation.verifications` back-relation). The scalar
  `investigationId` FK column already existed; this only adds
  the Prisma-side relation so scope filters can `where: {
  investigation: scope }`. No SQL migration required;
  `prisma generate` only.

### Fixed

- **Stale doc references** to v0.4.0 across the repo, picked
  up from the three post-v0.5.4 docs commits (`6d2e320`,
  `b86d86c`, `75d6737`). The version badge now reads from
  `package.json` so future bumps do not need a docs sweep.

### Notes

- 114/114 tests passing (was 100; +14 from the bridge test).
- Typecheck clean, lint clean, build green.

## [0.5.4] - 2026-05-21

Closes the three known issues carried forward from v0.5.3:
a Sigstore Rekor publishing bug, an intermittent BigInt
serialisation crash, and a missing-git-repo for the seeded
forensic case.

### Fixed

- **Sigstore Rekor publishing now works against the public log.**
  Switched the rekor backend from Ed25519+SHA-512 to ECDSA P-256
  +SHA-256, which is the most-deployed combination across the
  Sigstore ecosystem (cosign, sigstore-python, sigstore-js all
  default to it). The Ed25519 path passed local sign/verify
  round-trip but Rekor's hashedrekord verifier consistently
  rejected our submissions; the ECDSA path "just works". Files:
  `src/lib/attestation/backends/rekor.ts`, `rekor-codec.ts`,
  `rekor.test.ts`. Key file path moved from
  `rekor-ed25519.{pub,key}.pem` to `rekor-ecdsa-p256.{pub,key}.pem`
  so any old key on disk is ignored cleanly.
- **BigInt serialisation in the promote-finding endpoint.**
  `src/app/api/findings/[id]/promote/route.ts` previously
  returned the newly-created Evidence row directly via
  `Response.json`, which crashed `JSON.stringify` on the BigInt
  fields `size` and `byteCount` and surfaced as
  `[rbac] unhandled error TypeError: Do not know how to
  serialize a BigInt` in production logs. Now uses the new
  `jsonOk` helper.

### Added

- **`src/lib/safe-json.ts` + tests.** Generic BigInt-safe JSON
  response helper. `stringifyBigIntSafe` coerces `BigInt` to a
  decimal string at the serialisation boundary so numeric
  precision is preserved on the wire. `jsonOk(body, init?)` is a
  drop-in for `Response.json`. Six tests in
  `safe-json.test.ts`.
- **`scripts/backfill-case-repo.ts`.** One-off backfill for any
  Case whose `case-repos/<id>/` directory is missing (typically:
  cases seeded before the git engine was wired up). Walks the
  Evidence rows, writes each as a file in the repo, commits, and
  updates the `main` branch's `headHash` to the real git oid.
- **First operational Sigstore Rekor attestation** of the
  production audit chain head: log index 1595455804, UUID
  `108e9186e8c5677a75cb2125549804a3cbd198d634aec6f56b34b499ba08c69e9cb527dd56cc38f1`.
  Independently verifiable at
  https://rekor.sigstore.dev/api/v1/log/entries/108e9186e8c5677a75cb2125549804a3cbd198d634aec6f56b34b499ba08c69e9cb527dd56cc38f1
- **README Sigstore Rekor badge** restored to "attested" and
  linked directly to the live Rekor entry above. The wording is
  now backed by an operational, externally-verifiable artefact
  rather than just an implementation claim.

### Operations on demo.forenix.tech

- Backfilled `CASE-2025-007` (the seeded "Operation Sandstone"
  case) with a real Git repository. Three evidence rows
  committed; branch `main` headHash updated to `c642a2e4...`.
  All three cases on the droplet (CASE-2025-007, CASE-2026-002,
  CASE-2026-003) now have real repos under
  `/opt/forenix/case-repos/<id>/`.
- First production Rekor attestation written (above). Both
  attestation backends (`local` HMAC and `rekor` Sigstore public
  log) are now operationally validated against the production
  chain head.

Tests: 100/100 green. Typecheck clean.

## [0.5.3] - 2026-05-21

Operational truthfulness pass. A claim check of the v0.5.2 docs
against the live droplet surfaced a mix of multi-tenant
correctness gaps, dormant scheduled features, a real Sigstore
Rekor codec bug, and stale README badges. This release closes the
correctness gaps, activates the dormant features, and tightens
the badges to match operational reality.

### Fixed

- **Bridge endpoint tenant-scope propagation.**
  `src/app/api/bridge/inv-to-case/[id]/route.ts` now propagates
  `orgId` and `teamId` from the source investigation onto the new
  Case. Before this fix, every bridged case landed at
  `orgId=null` / `teamId=null` and silently fell out of the
  multi-tenant scope filter, becoming invisible to org-scoped
  users.
- **Case-report endpoint actor scoping.**
  `src/app/api/cases/[id]/report/route.ts` now scope-checks the
  case against `teamScopeWhere(actor)` before rendering. Returns
  `404` (not `403`) on foreign-org cases so existence does not
  leak across tenants.
- **Pipeline runner: per-actor rate limit + scope.**
  `src/app/api/pipeline/run/[id]/route.ts` authenticates via
  `requireSession`, scope-checks the investigation, and applies a
  per-actor rate limit (10 runs / hour) to cap runaway-bill risk
  from compromised accounts on the live hosted adapter.
- **Sigstore Rekor codec: SHA-512 for Ed25519.**
  `src/lib/attestation/backends/{rekor.ts, rekor-codec.ts}` now
  declare `algorithm: "sha512"` in the hashedrekord and sign the
  SHA-512 hash bytes, matching Rekor's enforcement for Ed25519
  keys (RFC 8032). Earlier code used SHA-256 and Rekor rejected
  every entry with `unsupported hash algorithm: "SHA-256" not in
  [SHA-512]`. Test fixtures updated.
- **Health endpoint reads `pkg.version`.**
  `src/app/api/health/route.ts` was hardcoded to `"0.1.0"`; now
  reads from `package.json` so the version stays accurate without
  manual edits.
- **README badge truthfulness.**
  `tests-61_passing` updated to current count. The Sigstore Rekor
  "attested" badge softened to a generic "attestation: chain head
  witnessed" badge linking to the security doc. The earlier wording
  implied operational Rekor attestation that did not yet exist on
  the deployment.

### Added

- **Generic rate-limit helper + tests.**
  New `src/lib/rate-limit.ts` exposes `checkRateLimit(key, limit,
  windowMs)` for any route that needs a bucket. Drop-in for the
  pattern previously duplicated in `/api/demo/try` and
  `/api/waitlist`. Three new tests in `rate-limit.test.ts`.
- **Audit-chain dump + verify scripts.**
  `scripts/dump-audit-log.ts` exports the chain as JSON; the
  v0.5.2 release referenced this script before it existed.
  `scripts/verify-audit-chain.ts` recomputes and verifies the
  chain using the canonical primitive from
  `src/lib/audit-chain.ts`.

### Operations on demo.forenix.tech

The fix-pass on the running deployment (not part of the
distributed release artefact but documented here for
completeness):

- Generated and provisioned `CRON_SECRET`, `MONITOR_CRON_TOKEN`,
  and `SEED_TOKEN` on the droplet `.env`.
- Same tokens registered as GitHub repository secrets so the
  cron-tick workflow can authenticate against
  `/api/internal/monitor-tick` and `/api/internal/attest-tick`.
- Set `ATTESTATION_BACKEND=local` on the droplet so the
  attestation system has a working default.
- First operational attestation row written via the local HMAC
  backend (`headHash: 991d386d9a10f810...`, covers 72 chain
  entries).
- Both dormant monitors fired their first scheduled runs in 7+
  days via the now-authenticated tick endpoint.
- Filled gaps in the OSINT toolchain on the droplet: installed
  `amass` (Go install + symlink), reinstalled `gowitness`,
  reinstalled `theHarvester` (pipx), and restored
  `sherlock` / `holehe` / `maigret` / `yt-dlp` after their venv
  was accidentally removed mid-session.

### Documentation

- **`.env.example` completion.** Every `process.env.*` reference
  in the codebase is now documented in `.env.example` with a
  one-line comment explaining what it controls. Added: `AUTH_URL`,
  `CRON_SECRET`, `CASE_REPO_ROOT`, `FORENIX_DISABLE_PDF`,
  `FORENIX_DISABLE_EVIDENCE_STORE`, `FORENIX_EVIDENCE_DIR`,
  `FORENIX_FORCE_GIT`, `FORCE_RESEED`, `GROQ_MAX_TOKENS`, `HIBP_API_KEY`,
  `HOST`, `HUNTER_API_KEY`, `NVIDIA_MAX_TOKENS`,
  `OPENROUTER_MAX_TOKENS`, `SHODAN_API_KEY`, `WORKER_URL`,
  `WORKER_TOKEN`. Excludes runtime-set vars (`PATH`, `NODE_ENV`,
  `VERCEL`, `VERCEL_URL`) which the host injects.

### Known issues carried forward

- **Sigstore Rekor publishing.** With the SHA-512 fix, Rekor
  accepts the algorithm but still rejects the signature for
  reasons that need deeper investigation (likely a public-key
  format / verifier-path interaction). The Rekor backend remains
  implemented and useful for self-hosters running a private
  transparency log, but submission to the public
  `rekor.sigstore.dev` is currently failing. The local HMAC
  backend (default) and the GitHub-issue backend are unaffected.

Tests: 94 / 94 green. Typecheck clean.

## [0.5.2] - 2026-05-21

Research-artefact corrections + reproducibility infrastructure.
Same-day patch on top of v0.5.1 after a thorough audit of the
research-side documentation surfaced several bibliographic and
methodological errors plus missing reproducibility scaffolding.
No product-surface changes.

### Fixed - Bibliography corrections

Independent verification against publisher records, journal
indexes, and library catalogues caught the following in the
v0.5.1 bibliography:

- Removed `ledueff2024hyperinvestigation`: the cited paper does
  not exist. Le Deuff's actual 2021 monograph *Hyperdocumentation*
  (ISTE / Wiley) remains in the bibliography.
- Removed `geist2020privacycanada`: the book *The Law of Privacy
  in Canada* exists but is authored by McIsaac, Shields, and Klein
  (Thomson Carswell), not edited by Michael Geist. Replaced with
  Geist's real edited volume *Law, Privacy and Surveillance in
  Canada in the Post-Snowden Era* (University of Ottawa Press,
  2015).
- Roth (2017) *Machine testimony*: corrected page range from
  1972-2259 to 1972-2053.
- Tokson aftermath of Carpenter: corrected year from 2020 to
  2022, starting page from 1791 to 1790 (Harvard Law Review 135).
- National Data Strategy chapter (CIGI 2018): corrected venue
  from "CIGI Paper No. 192" to chapter in the CIGI Special
  Report *Data Governance in the Digital Age*.
- Sidewalk Toronto governance paper: corrected year from 2019
  to 2020 (*Technology and Regulation* 2020:44-56).
- Human-rights approach to data protection (2020): corrected
  venue from a journal entry to the actual book chapter in
  *Citizenship in a Connected Canada* (U Ottawa Press).
- Berkeley Protocol on Digital Open Source Investigations:
  corrected year from 2022 to 2020 (launched December 2020).
  Fixed in bibliography.md, bibliography.bib, and
  research-questions.md.
- Garrie (2014) digital forensic evidence: added missing co-author
  Morrissy.
- Henseler and van Loenhout (2018): corrected first-author given
  name from "Jeroen" (J.) to "Hans" (H.).
- Aronson preserving human rights media: corrected year from
  2018 to 2017.
- McPherson (2015) digital human rights reporting: corrected
  book reference from *Citizen Journalism: Global Perspectives*
  (eds. Allan and Peters) to *Producing Theory in a Digital
  World 2.0* (ed. Lind, Vol 2 pp 193-209, Peter Lang). Different
  book entirely.
- Kerr *Implementing Carpenter*: corrected year from 2019 to
  2018 (SSRN posted December 2018, USC Law Legal Studies Paper
  No. 18-29).
- Added Cavoukian (2009) *Privacy by Design: The 7 Foundational
  Principles* (referenced in ethics.md but missing from the
  bibliography in v0.5.1).

### Fixed - REPLICATION.md inaccuracies

The v0.5.1 REPLICATION.md referenced two scripts that did not
exist (`scripts/dump-audit-log.ts`) and a non-existent function
(`verifyChainStandalone`). Created the scripts to match what the
documentation claimed; rewrote the verification section to use
the real bundled tooling.

- New: `scripts/dump-audit-log.ts` exports the full audit chain
  as JSON to stdout. Self-contained (no `@`-aliases, no
  `server-only` chain); usable from any shell that can reach the
  database.
- New: `scripts/verify-audit-chain.ts` reads the chain in
  insertion order and recomputes each row's SHA-256 hash against
  the previous row's hash plus the row's content. Imports
  `computeAuditHash` and `GENESIS_HASH` directly from
  `src/lib/audit-chain.ts` (the canonical pure helpers) so the
  verifier uses the same primitive the platform writes with.
  Exit code 0 on a clean chain, 1 on mismatch.
- `docs/research/REPLICATION.md` section 4 rewritten to reference
  the real scripts and the existing Python recipe in
  `docs/07-SECURITY.md` section 4.

### Fixed - SAT-rejection framing softened to match implementation

v0.5.1's research framing described conclusions arriving without
a SAT trace as "rejected at the storage boundary." Inspection of
the live case-study data shows the platform actually persists
such conclusions with confidence downgraded to `unverified` and
surfaces the schema-conformance failure to the operator, rather
than dropping them. The framing in `RESEARCH.md`, `docs/research/ethics.md`,
and `docs/research/case-studies.md` is corrected to describe the
actual behaviour.

### Added - Reproducibility infrastructure

- `docs/research/REPRODUCIBILITY.md`: a concise checklist of the
  conditions under which the empirical claims in `case-studies.md`
  and `RESEARCH.md` can be reproduced. Covers source / tag /
  archival DOI / dependency pinning / data / seed / hardware /
  wallclock cost / financial cost / test suite / CI / config /
  raw data / audit-chain verifier / pre-registration / ethics /
  conflict-of-interest / funding.
- `docs/research/case-studies/sigstore-data.json` and
  `archive-org-data.json`: full structured exports (investigation
  metadata, findings, entities, relations, reports, audit subset)
  for the two committed case studies. Lets a reviewer inspect
  the raw data behind the rendered PDFs rather than taking the
  PDFs on trust.
- `case-studies.md` configuration tables now state the LLM model
  (`openai/gpt-oss-120b:free` via OpenRouter) used for both runs.

### Added - Academic-norm additions to RESEARCH.md

- Section 9 (methodology cross-references): each design claim in
  the document is linked to the specific source file path that
  implements it, so a peer can verify implementation against
  claim.
- Section 10 (pre-registration): the project's intent to
  pre-register substantive empirical work on the platform before
  the first run.
- Section 11 (conflict of interest and funding): discloses the
  commercial deployment at demo.forenix.tech and the
  self-funded status of the work to date.

### Added - CITATION.cff completeness

- Added author affiliation (SZABIST University, MSc Cybersecurity,
  2026).
- Corrected the `url:` field to point at the GitHub repository
  rather than the marketing site (academic readers expect this to
  point at the code or the DOI, not the product page).
- Added a placeholder comment for the Zenodo DOI to be inserted
  once the GitHub-integration mints one for v0.5.2.
- Bumped version field to 0.5.2; expanded keywords.

## [0.5.1] - 2026-05-21

The multi-tenant + research-framing release. Phase 9.5 lands
organisation isolation end-to-end (schema, JWT, scope helper,
admin UI in the private overlay, SSE event filtering). The
repository also grows a research-side entry door (RESEARCH.md,
the docs/research/ tree, machine-readable CITATION.cff) so the
artefact can be approached as a research substrate rather than
only as a tool.

### Added - Phase 9.5: multi-tenant organisations (schema + scope)

Schema substrate landed in OSS Core; admin surface ships from the
private overlay so OSS-only deployments stay single-tenant by
default.

- `prisma/schema.prisma` + `prisma/schema.postgres.prisma`: new
  `Organization` model; nullable `orgId` + relation + index added
  to `User`, `Team`, `Investigation`, `Case`. Fully backward
  compatible; existing rows stay scoped to `orgId=null`.
- `src/auth.ts`: `orgId` propagated into the `authorize()` return,
  the `jwt` callback, and the `session` callback. The `update`
  trigger refreshes `orgId` + `role` from the database so an
  admin moving a user between orgs reflects in the next request
  without a full re-auth.
- `src/lib/rbac.ts`: `ActorContext` gains `orgId`. `teamScopeWhere()`
  extended with a four-row decision matrix covering super-admin,
  admin-within-org, non-admin-without-org, and non-admin-within-
  org. Single-tenant deployments behave identically; multi-tenant
  deployments get correct scoping for free across every list and
  read endpoint that already uses the helper.
- `src/types/next-auth.d.ts`: `User`, `Session`, `JWT` augmented
  with `orgId?: string | null`.
- `scripts/saas-backfill-orgids.ts`: one-off backfill helper with
  two modes (`--from-team` copies `team.orgId` onto investigations
  and cases linked to that team; `--all-to <slug>` assigns every
  remaining unscoped row to a named organisation).

### Added - Phase 9.5b chunk 3: SSE event filter by orgId

Closes the cross-tenant leak path on the live-event bus. Before
this chunk, every authenticated SSE client received every emitted
event regardless of which org owned the underlying row.

- `src/lib/events/types.ts`: `EventEnvelope` grows an optional
  top-level `orgId` field.
- `src/lib/events/emitter.ts`: `emit(topic, payload, orgId?)`
  carries tenant scope onto the wire; default `null` preserves
  pre-9.5 behaviour. `subscribe()` takes an optional filter
  predicate.
- `src/app/api/events/route.ts`: derives a per-actor filter from
  `requireSession()`. Super-admin sees every envelope; everyone
  else sees envelopes where `envelope.orgId` is null or matches
  `actor.orgId`.
- Producers updated: `appendAudit()` accepts `orgId`; the monitor
  scheduler derives the right scope from
  `monitor.investigation.orgId`. Standalone monitors stay global.
- Tests: two new cases in `src/lib/events/emitter.test.ts`
  covering envelope orgId stamping and the filter predicate.

### Added - `forenix init`: one-shot investigation bootstrap

A "`git add .`" entry point for the platform. Takes a target,
auto-derives a sensible default pipeline configuration based on
the target type, creates the investigation, returns absolute
URLs.

- `scripts/init.ts`: CLI form. Direct Prisma; no @-aliases.
  Args: `--target`, `--type`, `--objective`, `--title`,
  `--priority`, `--created-by`.
- `POST /api/investigations/init`: API form. Same semantics; auto-
  derives `defaultAgentGroups` by target type.

### Added - Pipeline runner reliability

- `POST /api/pipeline/run/[id]`: wraps the full pipeline in
  try/catch and registers an `AbortSignal` handler that flips
  status to `failed` if the client disconnects mid-run. Closes
  the path where a long LLM call could leave an investigation
  stuck at `status=running` forever after a serverless cold-stop
  or a tab close.

### Added - `Droplet admin (one-off)` workflow

- `.github/workflows/droplet-admin.yml`: workflow_dispatch entry
  point for allow-listed ops scripts on the demo droplet. Saves
  the round-trip of SSH-ing the droplet by hand for routine ops
  (org bootstrap, orgId backfill). Allow-list and case-validator
  at runtime so a malformed dispatch cannot run an arbitrary
  command.

### Added - Research-framing companion

The artefact ships a research-side entry door for readers
approaching forenix-oss as a research substrate rather than as a
tool. Additive to the existing product-side README; no commercial
framing changed.

- `RESEARCH.md`: design-science framing, four open research
  questions enabled by the platform, disciplinary positioning
  across intelligence studies, information law, digital
  forensics, and software engineering research.
- `CITATION.cff`: machine-readable Citation File Format manifest
  at the repository root for Zotero, Mendeley, and other
  reference managers.
- `docs/research/research-questions.md`: full literature-gap
  framing for each of the four research questions.
- `docs/research/case-studies.md`: methodology and measured
  outputs from the two case studies (Sigstore, Internet Archive)
  run against the deployed instance, with the rendered admissible
  PDFs committed alongside under `docs/research/case-studies/`.
- `docs/research/ethics.md`: intended use, operator responsibility
  under PIPEDA / GDPR / post-Carpenter doctrine, and the
  rights-protective design choices the platform encodes by
  default.
- `docs/research/REPLICATION.md`: a research-targeted quick-start
  that gets a reviewer from `git clone` to a working local
  instance with seeded data in approximately ten minutes.
- `docs/research/bibliography.md` + `bibliography.bib`: working
  bibliography in markdown and BibTeX, ~70 entries across ten
  sections.
- `docs/10-ANALYTIC_FRAMEWORK.md`: small opening that cross-links
  to `RESEARCH.md` and the bibliography.

### Notes

The private overlay (`thunderstornX/forenix-saas`, not part of
this repository) gained the matching org administration surface
during this window: organisation CRUD endpoints, the admin
Organisations view in the SPA, and the operator CLI for
bootstrapping the first organisation. Overlay versions tracked
as `v0.5.0+saas2`. None of that code lives in OSS Core; the
substrate this release ships is sufficient for OSS-only
deployments to add their own administration surface.

## [0.5.0] - 2026-05-20

The visitor-funnel + ops-automation release. Vercel concept surface
gains a "try the demo" path; admins on DO get an in-app waitlist
triage view; the deploy pipeline auto-syncs OSS + private overlay to
the DO droplet on every push; security pass on every token-gated
endpoint. Premium code extracted to a private overlay; OSS Core is
now pure OSS, deployable end-to-end without any premium dependency.

### Added - Phase 9.4b: admin waitlist UI

In-app surface to triage waitlist signups: filter by pending /
invited / declined / all, approve (creates User, shows credentials
once for the admin to email), decline (reversible), live updates
via SSE on `audit.append`. New views entry under Account, admin-only.
- `POST /api/admin/waitlist/[id]/approve`: generates an 18-char
  base64url password, hashes it, creates the user, marks the
  waitlist row invited, returns the credentials in the response.
- `POST /api/admin/waitlist/[id]/decline`: idempotent mark-declined.
- `useAdminWaitlist` / `useApproveWaitlist` / `useDeclineWaitlist`
  hooks in `src/lib/hooks.ts`.

### Added - Phase 9.4a: visitor "try the demo" path

Public funnel from `forenix.tech` into the seeded dashboard
without joining the waitlist. Gated by `DEMO_VISITOR_ENABLED=true`
(set on Vercel only; the DO paid surface stays invite-only).
- `GET /api/demo/try`: env-gated, rate-limited (20/IP/min),
  idempotently upserts a `viewer`-role demo user and adds them to
  every existing team so they see seeded data. Respects manual
  disable. Returns the demo credentials for the client to
  `signIn()` with.
- `TryDemoButton` client component on the marketing page,
  conditionally rendered server-side based on the env flag.
- Drops the broken `demo.forenix.tech` link from marketing
  (that surface is invite-only and was sending visitors into a
  sign-in wall).

### Added - DigitalOcean auto-deploy + waitlist sync

Stops the DO droplet (demo.forenix.tech, the paid SaaS) from drifting
out of sync with `main`, and unifies the waitlist so admins on DO see
every signup from both surfaces.

- **`.github/workflows/deploy-droplet.yml`** - on every push to `main`
  (and via workflow_dispatch), checks out OSS Core + the private
  overlay (`thunderstornX/forenix-saas`, pulled via
  `SAAS_REPO_TOKEN`), assembles them, rsyncs onto the droplet, then
  runs the deploy script. Includes a `/api/health` smoke check.
- **`scripts/deploy-droplet.sh`** - runs on the droplet: install,
  prisma generate + push (postgres), build, `sudo systemctl restart
  forenix.service`. Idempotent; safe to re-run by hand.
- **`POST /api/admin/waitlist-import`** - token-gated receiver for
  signups arriving from another deployment. Idempotent on email,
  preserves the original createdAt so queue positions stay meaningful.
- **`POST /api/waitlist` forwards** - after the local upsert, fires a
  best-effort `POST` to `WAITLIST_SYNC_URL` with `Authorization:
  Bearer $WAITLIST_SYNC_TOKEN`. Vercel sets these env vars to point
  at the DO droplet so signups on forenix.tech mirror to
  demo.forenix.tech. Fire-and-forget; never blocks the user.
- **`scripts/sync-waitlist-once.ts`** - one-time backfill helper.
  Reads every waitlist row from the local DB and POSTs to
  `WAITLIST_SYNC_URL`. Idempotent.
- **`docs/09-RUNBOOK.md` §13 + §14** - full operator runbook for
  setting up the deploy secrets, droplet sudoers entry, and the
  cross-deployment sync (env vars + backfill).

### Changed

- **`chore(saas)`** (commit 14e52c4): premium tier extracted into a
  private overlay (`thunderstornX/forenix-saas`). Public repo no
  longer ships premium code. See [`docs/SAAS.md`](docs/SAAS.md) for
  the overlay model.

### Security

- Constant-time bearer comparison for every token-gated route
  (`MONITOR_CRON_TOKEN` / `CRON_SECRET` on `monitor-tick` +
  `attest-tick`, `WAITLIST_SYNC_TOKEN` on `waitlist-import`,
  `SEED_TOKEN` on `seed-demo`). Shared helper at
  `src/lib/security.ts` (timingSafeEqual on padded buffers).
  Closes a low-severity timing-side-channel that could leak
  short prefixes of any of those secrets under repeated probing.
- Security headers on every response via `next.config.ts`:
  `Strict-Transport-Security` (2y + preload),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying camera/microphone/geolocation/
  payment/usb. CSP deliberately deferred — needs careful design
  around Tailwind 4 inline `@theme` + the Next bootstrap script.
- `/api/demo/try` now rate-limited (20/IP/min) and respects a
  manually disabled demo user (no silent re-enable on next visit).
- 4 new unit tests for `timingSafeStringEqual` + `bearerFromHeader`.

### Marketing / UI

- Court Document design language across landing, waitlist, sign-in
  (commit 2ff6058). Serif `Newsreader` body + `Instrument Serif`
  display, parchment + oxblood palette, numbered §I-§V sections
  with drop caps, marginalia, footnotes, exhibits, italic stamps.
- Editorial repo banner + wax-seal logo (commit 99ed4d4). Centred
  badges in README. Dashboard typography polish (sidebar wordmark
  in serif with italic slash, page H1 + stat values in display
  serif).
- Light-mode contrast + mobile responsive fixes (commit 33bc932).
- Topbar responsive fixes (commit de0f356): right-cluster items
  collapse to icons at narrow widths, breadcrumb hides below `lg`,
  title truncates with ellipsis. Sidebar footer now shows the
  actual user role rather than a hardcoded "analyst" fallback.

### Docs

- `docs/SAAS.md`: rewritten as a short pointer to the overlay
  model + the three-lane map.
- `docs/OSS_INSTALL.md`: new unified self-host guide (Docker,
  VPS, local dev).
- `docs/DEV_FLOW.md`: new — where work lands, push-to-deploy
  pipelines, catch-up across surfaces, testing layers, release
  cadence.
- `docs/09-RUNBOOK.md` §13 + §14: deploy automation + waitlist
  sync runbooks.

### Fixed

- `vercel-build` runs `scripts/seed-if-empty.ts` between db push
  and `next build`, so a fresh Vercel deploy lands with seeded
  demo data instead of an empty dashboard. Checks Investigation
  count (not User) since demo-visitor upserts create users but no
  investigations.
- Demo visitor added to every existing team on first sign-in, so
  the dashboard shows the seeded data instead of 0/0/0.
- `/api/health` joined `PUBLIC_ROUTES` so smoke checks + load
  balancers can reach it without a session.
- Deploy script PATH no longer requires `~/.bashrc` to be sourced
  (`scripts/deploy-droplet.sh` exports `$HOME/.bun/bin` directly).

### Added - SSE live updates (Phase 9.3 / item 3 of 3, closes sprint)

The dashboard now reflects monitor runs, attestation runs, and
audit appends as they happen, without polling. Closes the Phase
9.3 sprint and makes the marketing "live verification" claim
literal.

- **`src/lib/events/{types,emitter}.ts`** - five typed topics
  (`monitor.run.{started,completed}`,
  `attestation.run.{started,completed}`, `audit.append`) and a
  process-singleton emitter on `globalThis` (HMR-safe). Wildcard
  channel for catch-all subscribers. Single-process for now; the
  SaaS lane will swap in Postgres LISTEN/NOTIFY without changing
  the public surface.
- **`GET /api/events`** - session-gated SSE endpoint with `?topics=`
  filter, 25 s keep-alive comments, `X-Accel-Buffering: no` for
  nginx, cleans up on the request's AbortSignal.
- **`src/hooks/use-live-events.ts`** - EventSource wrapper with
  exponential reconnect (1 s -> 30 s cap), topic filtering,
  ref-stable callback handling, and a `connected` flag for UI.
- **Producers wired**: `appendAudit()` emits `audit.append`;
  `runOneMonitor()` emits started + completed; `runAttestation()`
  emits started + completed (manual + scheduled paths produce
  identical event streams).
- **Consumers wired**: Monitors / Integrity / Audit views invalidate
  their TanStack Query keys on the relevant events. Topbar gains a
  small "live" pulse driven by the SSE connection state.
- **Tests** - 5 cases for the emitter (typed delivery, wildcard,
  topic isolation, unsubscribe, multi-subscriber). All 80 tests
  across the suite pass.

### Added - cron-triggered attestations (Phase 9.3 / item 2 of 3)

Closes the strongest gap in the chain-of-custody story: the
"Attest now" button was always manual, which meant the chain
witnesses were only as fresh as the operator's memory. This wires
the cron infrastructure shipped in item 1 to fire attestations too.

- **`AttestationSchedule` Prisma model** - one row per backend
  you want fired automatically. Each can run on its own cadence
  (typical setup: local hourly + github daily + rekor weekly).
- **`src/lib/attestation/scheduler.ts`** - reuses
  `runAttestation()` so the cron path and the manual button produce
  identical Attestation rows. Failures advance the schedule (one
  network blip can't permanently disable a backend) and the error
  is surfaced in the schedule row's `lastError`.
- **`POST /api/internal/attest-tick`** - same auth gate as
  monitor-tick (`MONITOR_CRON_TOKEN` or `CRON_SECRET`, with or
  without `Bearer` prefix).
- **Admin routes**:
    - `GET / POST /api/admin/attestation-schedule`     list / create
    - `PATCH / DELETE /api/admin/attestation-schedule/[id]`  pause/
                                                              resume,
                                                              edit cadence,
                                                              delete
- **Integrity dashboard** gains a "Scheduled attestations" panel
  (admin only): backend column, cadence picker, status pill,
  last-run / next-run, per-row pause/resume + delete, last-error
  display when a run failed.
- **`vercel.json`** gains an `attest-tick` cron entry at 8:30am
  daily (still Hobby-compliant: 2 entries, both daily).
- **`.github/workflows/cron-tick.yml`** (renamed from monitor-tick)
  adds a separate `attest` job so a slow Rekor anchor doesn't delay
  the next monitor tick.
- Every schedule action appends an audit row
  (`attestation_schedule_created`, `_paused`, `_resumed`,
  `_updated`, `_deleted`) so the chain notarises its own scheduling
  alongside its events.
- `docs/09-RUNBOOK.md` §12 covers cadence pairings, drivers, and
  operator setup.

### Added - scheduled monitors (Phase 9.3 / item 1 of 3)

The Monitor rows have always carried `cadence` + `nextRunAt`
columns; this turn finally wires a scheduler that fires them.

- **`src/lib/monitor-scheduler/`** - new module:
    - `cadence.ts`        - parser for the cadence DSL
                            (`hourly`/`daily`/`weekly`/`monthly` or
                            `every:N(m|h|d)`), with a 1-min floor
                            and a 90-day ceiling. 14 pure-function
                            tests for the grammar + the `isDue`
                            grace-window predicate.
    - `scheduler.ts`      - `runMonitorTick()` finds active rows
                            where `nextRunAt <= now + 60s grace`,
                            runs each through the always-available
                            HTTP tool subset (`web_search` +
                            `crtsh_certificates` for now -  enough
                            to prove the wiring without needing
                            subprocess deps on Vercel), persists a
                            `MonitorRun` row, advances `nextRunAt`.
                            Failures still advance the schedule so
                            one bad tick doesn't permanently disable
                            a monitor.
- **`POST /api/internal/monitor-tick`** - token-gated endpoint that
  both cron drivers POST into. Accepts either `MONITOR_CRON_TOKEN`
  or Vercel's built-in `CRON_SECRET`, with `Bearer` prefix optional.
- **`vercel.json`** gains a `crons` block that hits the tick every
  5 minutes; `docs/09-RUNBOOK.md` documents the matching systemd
  timer for the Droplet.
- **Monitor CRUD now exists**:
    - `POST   /api/monitors`         create (investigator+)
    - `PATCH  /api/monitors/[id]`    pause/resume, change cadence,
                                      change target
    - `DELETE /api/monitors/[id]`    delete (investigator+)
    - `POST   /api/monitors/[id]/run` run-now (bypasses next tick)
  Every state-change appends an audit row (`monitor_created`,
  `monitor_paused`, `monitor_resumed`, `monitor_updated`,
  `monitor_run`, `monitor_deleted`) so the chain notarises the
  schedule alongside the cases.
- **Monitors view** in the authed app gains controls:
  'New monitor' header action with a cadence picker, per-card
  'Run now' / 'Pause' / 'Resume' / cadence-select / 'Delete' under
  a hairline divider. Read-only for analysts/viewers; mutating
  controls hidden for them.
- **`.env.example`** documents `MONITOR_CRON_TOKEN`; the Vercel
  surface uses the built-in `CRON_SECRET` set in the project env.
- Test count: 61 -> 75 (14 new cadence-parser tests).

## [0.4.0] - 2026-05-17

External attestation of the audit chain head. Closes the long-standing
"DB admin rewrites + re-signs the whole chain" gap in the threat model
that's been sitting in the roadmap since v0.2.0.

### Added - external attestation of the audit chain

- **New `Attestation` model** + `src/lib/attestation/` library
  implementing the long-standing "DB admin rewrites + re-signs the
  whole chain" gap in the threat model. The chain alone proves
  no-tampering only against attackers without DB-write access;
  external attestations pin the head hash periodically to a witness
  the maintainer can't unilaterally rewrite.
- **Three backends ship now, more without schema changes:**
    - `local`  - HMAC-SHA256 over the head, keyed on `AUTH_SECRET`.
      Always-available; offline-verifiable; catches accidental
      corruption + naive tampering. Honest about not being external.
    - `github` - posts the head as a JSON comment to a designated
      issue. GitHub's per-comment edit history makes tampering
      detectable, not impossible.
    - `rekor`  - posts an Ed25519-signed `hashedrekord` entry to the
      public Sigstore transparency log (https://rekor.sigstore.dev).
      Inclusion proofs + signed-entry-timestamps issued by Sigstore's
      own keys and replicated across the network. Trust shrinks to
      "Sigstore didn't conspire with the maintainer."
- **`/api/attestation` route**: `GET` lists recent witnesses,
  `POST` (admin-only) records a new one; `GET /:id/verify`
  re-fetches the witness and confirms it still pins the original
  head.
- **Integrity dashboard now surfaces attestations** below the chain
  status: backend, short head hash, status, external link, per-row
  "Verify now" button. Admin sees an "Attest now" control + a
  per-run backend override.
- **The attestation event is itself an audit row**
  (`action=attest_chain`). So the next attestation witnesses the
  previous attestation — the witness history is itself tamper-
  evident.
- **Rekor keypair** is a lazy-generated Ed25519 pair under
  `REKOR_KEY_DIR` (defaults to `.attestation-keys/`), 0600 on the
  private key, gitignored via both `*.pem` and an explicit dir rule.
- 22 new tests across `local.test.ts`, `github.test.ts`, and
  `rekor.test.ts` (HMAC + envelope + Rekor-codec round-trips,
  tamper-detection, secret-rotation, tolerant parse). Bun test
  count: 39 -> 61.
- Docs: new "External attestation of the chain head" section in
  `docs/07-SECURITY.md` (threat model, three-backend table,
  configuration, compromise drill).
- `.env.example`: `ATTESTATION_BACKEND`, the `ATTEST_GITHUB_*`
  block, and the `REKOR_*` block under a new section.

### Fixed

- **Middleware auth was breaking under HTTPS reverse proxy** (Caddy
  on the self-host, Vercel edge on the serverless surface).
  `getToken({ req })` inferred `secureCookie` from `req.url`, which
  for proxied requests is always the internal `http://localhost:3000`,
  so it looked for the non-`Secure-` cookie name. Browsers + curl
  rightly sent the `__Secure-authjs.session-token` cookie issued
  under HTTPS, so getToken never found it and the middleware 401-ed
  every protected route. Fixed by computing `isHttps` from
  `AUTH_URL/NEXTAUTH_URL` (`https://...`) or
  `X-Forwarded-Proto: https` and passing `secureCookie: isHttps`
  explicitly. Same bug recurrence as the nip.io attempt in v0.2.0.

### Added - live domains

- **forenix.tech** registered (GitHub Student Pack via the .tech
  registry). Wired so:
    - `forenix.tech` + `www.forenix.tech` -> Vercel (concept demo).
    - `demo.forenix.tech` -> DigitalOcean Droplet (full feature demo
      with HTTPS via Caddy auto-Let's Encrypt).
- README now lists the canonical demo URLs in the "Deployment models"
  section.

## [0.3.0] - 2026-05-17

Real file bytes on disk and a forensic-grade PDF report. The two
items most-mentioned as missing in the v0.2.0 review.

### Added - file-byte evidence storage (Phase 9.1)

- **Content-addressed disk store** at `src/lib/evidence-store.ts`.
  Streams uploaded bytes through a SHA-256 hash, writes to
  `{store}/{caseId}/{sha[:2]}/{sha}` atomically (temp file + rename),
  deduplicates identical bytes within a case automatically. Hard cap
  per upload at 500 MB (configurable).
- **Evidence schema** gained two new columns:
    - `objectKey String?`  - the content-addressed relative path on disk.
      Non-null means the evidence has a real underlying file.
    - `byteCount BigInt`   - the file size in bytes.
  The `hash` column on these rows is now SHA-256 *over actual bytes*
  (forensic identity), not over finding text.
- **New endpoints**:
    - `POST /api/evidence/upload` (multipart/form-data: caseId + file)
    - `GET  /api/evidence/[id]/download` (streams bytes back to caller, audits the access)
    - `POST /api/evidence/[id]/verify-bytes` (re-hashes the file on disk, audits the result)
- **Upload UI** on the Evidence view: drag-or-pick a file, choose a
  case, submit. Hash is computed server-side as bytes stream through.
- **Vercel graceful degradation**: `evidenceStorageEnabled()` returns
  false on Vercel; the upload route 503s with a clear message. The UI
  shows an explanatory toast.
- **Test coverage**: 8 new tests for the store (`src/lib/evidence-store.test.ts`)
  covering content-addressed pathing, dedup, re-hash + verify,
  tamper detection, path-traversal rejection, empty-upload rejection,
  maxBytes enforcement.

### Added - PDF export of admissible reports (Phase 9.2)

- **`src/lib/case-report.ts`** - HTML renderer for a forensic-grade
  case report:
    - Cover page with case metadata + custodian + report timestamp.
    - **Chain-of-custody attestation block** showing chain length, head
      hash, genesis hash, verify status, and a SHA-256 report digest
      over the report contents themselves (so a printed PDF can be
      tied to a known state of the case).
    - Evidence inventory table (name, type, status, size, SHA-256,
      object key, added timestamp).
    - Findings (up to 50) with agent group, confidence, priority,
      verification status, description + reasoning-trace excerpt.
    - Audit log sample (last 100 entries) with timestamp, action,
      entity, actor, hash.
  Light-theme print-ready; uses the same OKLCH design tokens as the app.
- **`GET /api/cases/[id]/report`** (HTML preview) and
  **`?format=pdf`** (Playwright-rendered A4 PDF download).
- **Export buttons** on the Case detail view: "Export PDF" and "Preview"
  (HTML in a new tab).
- **Vercel graceful degradation**: PDF format requires Chromium, which
  Vercel can't spawn. Returns 503 with a clear message; the HTML
  preview works everywhere.

## [0.2.0] - 2026-05-17

The "Monster Mode" release. Real Git per case, real LLM tool-loop
with 20 wired OSINT tools, encrypted admin vault, structured-analytic
trace per finding, full theme system.

### Added - investigative depth

- **Per-case Git repositories** via isomorphic-git. Real commits,
  branches, merges, conflict detection. Cloneable and inspectable
  without the app running. `FORENIX_FORCE_GIT=1` opts in on hosts
  with persistent disk; serverless hosts fall back to deterministic
  SHA-256 commit hashes (so the UX never lies about which mode).
- **20 OSINT tools wired** into a unified registry with OpenAI-shape
  function definitions:
    - HTTP-first (works everywhere): DuckDuckGo, generic HTTP fetch,
      crt.sh, WHOIS lookup, Shodan, Hunter.io, HaveIBeenPwned.
    - Subprocess (self-host only): sherlock, holehe, theHarvester,
      maigret, subfinder, httpx, dnsx, amass, nuclei, exiftool,
      yt-dlp, tesseract, gowitness.
- **LLM tool-loop** (`src/lib/ai/tool-loop.ts`) - multi-step
  function-calling loop that lets the model pick which tools to run,
  feeds tool output back, and finalises with structured findings.
- **SAT-grounded prompting** (`src/lib/ai/sat-prompts.ts`) - per-agent-
  group system prompts that force the LLM to emit a structured Coulthart
  / Heuer trace (Key Assumptions Check, ACH matrix, indicators,
  credibility scoring).
- **Encrypted API-key vault** - `ApiKey` model + AES-256-GCM at rest
  (`src/lib/secrets.ts`); admin-only UI in the Vault panel; keys
  injected into `process.env` only when invoking tools.

### Added - UI

- **Enterprise design tokens** via OKLCH colour space - light + dark
  themes, 5 accent palettes (slate / indigo / amber / emerald / mono),
  3 density modes (compact / standard / comfortable).
- **Theme system** (`src/lib/theme.tsx`) - persistent light/dark
  toggle + accent picker in the topbar; flash-free SSR via inline
  pre-paint script.
- **fx-* primitive layer** (`fx-app`, `fx-side`, `fx-top`, `fx-card`,
  `fx-btn`, `fx-input`, `fx-chip`, `fx-table`, `fx-stat`...) refactored
  out of the legacy glass / forensic-glow utilities. Back-compat
  shim keeps existing view components working through the migration.
- **Designed SVG banner** (`docs/banner.svg`) replacing the ASCII text
  banner in the README.

### Added - resilience

- **Pipeline route never 500s on LLM trouble**. If the model emits
  malformed JSON or empty content after the tool-loop, `chatAnalyze-
  Pipeline` emits a sentinel finding capturing the raw output + parse
  error. `chatExtractEntities` and `chatTagEvidence` similarly tolerate
  bad output.
- **`extractJson` hardened** with brace-walking JSON-end detection,
  trailing-prose tolerance, and a comma-strip repair fallback before
  giving up.
- **`chatComplete` returns "" instead of throwing** on empty completions
  - reasoning-style models routed via OpenRouter sometimes return only
  the `reasoning` field with no `content`.

### Added - deployment story

- **Three independent deployment shapes** from the same codebase, all
  documented in the README:
    1. **Self-host (mock)** - full UI, deterministic data, no API key.
    2. **Self-host + real LLM + deep toolchain** - full feature parity.
    3. **Serverless concept demo (Vercel)** - gracefully degraded
       (SHA-256 git fallback, HTTP-API tools only, instant load).
- **`docs/SELF_HOST.md`** - complete Ubuntu 24.04 walkthrough
  (runtime, deep OSS toolchain install, env, systemd, Caddy
  reverse-proxy auto-HTTPS, optional LLM wiring).
- **GitHub-button-style one-click Vercel deploy** in the README.

### Changed - hygiene

- README rewritten - no demo-credential disclosure (platform is now
  invite-only operationally); generic LLM adapter section with no
  provider recommendation; clearer three-tier deployment narrative.
- **All 28 screenshots regenerated** against the new redesign UI.
  Old `docs/screenshots/` removed; `docs/manual_screenshots/` is the
  single canonical set.
- Sign-in page no longer pre-fills the admin email/password.
- Manual-screenshot driver (`scripts/manual_screenshots.mjs`) now
  signs in as the seeded admin automatically.
- Typography pass across all `.md` and code files: em dashes,
  en dashes, ellipses, middle dots, multiplication signs, and the
  warning/check-mark emoji set normalised to ASCII equivalents.
- `next.config.ts` dropped `output: "standalone"` - was leaking
  "next start does not work with output: standalone" warnings into
  production logs.

### Removed

- **YC pitch material** (`docs/pitch/`, `scripts/gen_pitch_deck.py`).
  This was private and never belonged in the public repo.
- Old `docs/screenshots/` directory (pre-redesign frames).

### Security

- API keys stored in the new `ApiKey` table are encrypted at rest
  with AES-256-GCM. `AUTH_SECRET` is the key material; ciphertext +
  iv + tag are stored separately. `preview()` returns a redacted
  representation for the admin UI.
- All vault-decrypted keys are injected into `process.env` lazily
  per request and bounded by a 30 s in-memory cache.

## [0.1.0] - 2026-05

The first tagged release. Open-source core complete and
production-ready.

### Added  -  platform

- **Merged Prisma schema** combining the Argus OSINT model with
  the ForenX forensic case model. Two new bridge columns:
  `Investigation.caseId` and `Finding.evidenceId`. New `Team`,
  `TeamMember`, `TeamInvite` models with optional `teamId` on
  `Case` + `Investigation`.
- **AI adapter pattern**  -  one interface (`src/lib/ai/types.ts`),
  six concrete adapters: `mock`, `ollama` (stub), `glm` (stub),
  `claude` (stub, SaaS-gated), `openrouter`, `nvidia`, `groq`.
  Two are live-tested end-to-end (NVIDIA and OpenRouter and Groq).
- **Audit hash chain**  -  SHA-256 forward chain over every state
  change. `appendAudit()` is the only legal write path.
  `verifyAuditChain()` replays the whole log; the UI exposes
  one-button verification.
- **15 views**  -  Dashboard, Investigations (list + detail),
  Pipeline runner, Cases (list + detail), Evidence, Branch Graph
  (SVG), Entity Graph (SVG), Network Graph (SVG), Monitors,
  Verification, AI Lab, Reports, Audit, Integrity, Reviews.
  Plus account-side: Teams, Settings, Admin.
- **Command palette ⌘K** with searchable jump-to across nav +
  investigations + cases + reports.
- **Analyst actions**  -  verify finding, promote finding to
  evidence, seal evidence; each writes an audit row.
- **Cursor pagination** on the heavy list endpoints
  (`/api/investigations`, `/api/cases`, `/api/audit`,
  `/api/evidence`).
- **Inline filters** on every list view.
- **URL deep-links**  -  `?view=...&inv=...&case=...&palette=1`.

### Added  -  auth + RBAC

- **next-auth v5** with credentials provider and JWT sessions.
- **RBAC** via `requireSession()` + `requireRole()` + four
  global roles (admin / investigator / analyst / viewer).
- **Team scope**  -  `teamScopeWhere(actor)` filters list queries
  automatically. Admins bypass.
- **Sign-in page** with three seeded demo accounts pre-listed.
- **Admin console**  -  manage users (create / role-change /
  enable-disable), teams (create with slug validation), and
  generate invite links (token-gated, copy-to-clipboard UX).
- **Teams view**  -  every authenticated user sees their own
  memberships + members.
- **Accept-invite flow** at `/accept-invite?token=...`.

### Added  -  infrastructure

- **GitHub Actions CI** (`.github/workflows/ci.yml`)  -  typecheck,
  lint, Prisma validation (both schemas), tests, seed smoke,
  build. Runs on every push and PR.
- **Bun test runner**  -  15 tests covering audit-chain
  determinism + tamper-detection, and the chat-completions
  JSON extractor.
- **Production Dockerfile**  -  multi-stage (deps -> builder ->
  runtime) on `node:20-slim`. Non-root user. HEALTHCHECK on
  port 3000.
- **docker-compose**  -  one command brings up Postgres + the app.
- **Vercel deploy path**  -  `vercel.json`, Postgres-flavoured
  Prisma schema, `vercel-build` script, `maxDuration = 60` on
  the pipeline route, token-gated `/api/admin/seed-demo`
  bootstrap endpoint.

### Added  -  documentation

- 9 long-form docs under `docs/` covering BRD, SRS, SDS, DFD,
  Deployment, Architecture, Security, API, and Runbook.
- **User Manual**  -  42-page PDF with embedded screenshots.
- **How-To Guide**  -  25-page PDF with task-oriented recipes.
- **YC pitch deck**  -  17-slide editable `.pptx` + PDF.
- **Feature catalogue** at `docs/FEATURES.md` with one section
  per view.

### Security

- Audit chain documented + verifiable offline in ~12 lines of
  Python.
- Zod-validated POST/PUT bodies on every mutating route.
- `server-only` marker on every server module that touches
  Prisma or env secrets.
- Factory deliberately falls back to `mock` on a bad
  `AI_ADAPTER` value  -  never to a paid adapter.
- Adapter HTTP calls have a 90 s AbortController timeout.

[Unreleased]: https://github.com/thunderstornX/forenix-oss/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.3.0
[0.2.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.2.0
[0.1.0]: https://github.com/thunderstornX/forenix-oss/releases/tag/v0.1.0
