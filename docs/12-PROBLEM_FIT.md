# Honest problem-fit evaluation

*Written after Phases A–E shipped, before users have touched it.
The goal here is to be uncomfortably specific about what works,
what doesn't, and who would genuinely benefit.*

---

## 1. The problem we claim to solve

**Investigators who mix open-source intelligence with forensic
case management run on two disconnected toolchains.** The OSINT
side is Maltego, SpiderFoot, Hunchly, plus a pile of CLI tools
(sherlock, amass, theHarvester, holehe, …). The forensic side is
EnCase, AXIOM, Cellebrite, Relativity. The handoff between the
two is manual: an analyst finds something on the open web, exports
a screenshot or a CSV, emails it to the case team, and someone
manually records its hash in an Excel sheet that lives on
SharePoint.

**That handoff is the bug.** It loses provenance, it loses tool
output, it loses audit chain. The investigator's defence in front
of a sceptical reviewer — "how do you know you didn't tamper with
this between Hunchly and EnCase?" — is a personal claim, not a
cryptographic one.

forenix-oss collapses both halves into one app with a real Git
repository per forensic case, a SHA-256 forward-chained audit log
over every state change, and an AI-orchestrated tool runner that
captures the actual tool output (sherlock JSON, theHarvester JSON,
Shodan banners, …) directly into the evidence record.

---

## 2. Does it actually solve that problem? Honestly?

### Yes, materially:

- **The Git engine is real.** Phase A wired isomorphic-git per
  case. Each evidence record is a JSON file in a real Git repo,
  each commit has a real SHA-1 oid, merges have real conflict
  detection. A third party can clone the case repo and `git log`
  it without forenix-oss running. That's a defensible custody
  story.
- **The audit chain is real and reproducible.** SHA-256 forward
  chain over every write. Verified offline in 12 lines of Python
  (see `docs/07-SECURITY.md`). Cannot silently mutate without
  detection.
- **Tool output is captured.** Phase B wired 10 tools (4 OSS
  subprocess + 4 free HTTP + 3 API-keyed). When the LLM invokes
  `sherlock_username("foo")`, the actual sherlock output is
  passed through to the finding's reasoning trace. Not a
  fabricated snippet.
- **Findings carry structured analytic reasoning.** Phase C
  forces every finding to carry a SatTrace object — which
  Structured Analytic Technique was applied, what inputs scored
  what credibility, which competing hypotheses lost on
  disconfirming evidence. This is the rendering UI an analyst
  actually wants: not "the model thinks X", but "the model
  applied ACH to these 4 candidates and selected X because of
  these 3 disconfirming pieces of evidence".

### Partially:

- **The case repo lives on the same host as the platform.**
  That's fine for self-host but mediocre for the Vercel demo (no
  persistent filesystem). For Tier 3, we'd push case repos to a
  separate object store (R2 / S3) and run isomorphic-git over
  HTTP. Schema is ready; the file-bytes work is queued.
- **Subprocess tools require self-host.** Vercel can't spawn
  sherlock/theHarvester. The platform falls back to the API-only
  tools (Shodan, Hunter, HIBP, crt.sh, whois, DDG search,
  http_fetch) on Vercel. That's still a real OSINT toolset, just
  narrower. The `WORKER_URL` env lets a self-hosted laptop bridge
  the gap if the user wants full feature parity on the demo.
- **Audit chain is per-deployment, not global.** A bad actor with
  root on the server can mutate the chain *and* the verifier.
  External attestation (notarising the chain hash to a public
  ledger) would close that gap; that's a Tier 3 line item.

### Not yet:

- **Real-time collaboration.** TanStack Query refetches on focus,
  not via websocket push. Two analysts looking at the same case
  see lag. Phase 8 task — not blocking for a courtroom artefact,
  blocking for "interactive war-room" UX.
- **Evidence-file bytes.** Today the platform stores hashes and
  metadata. To make this a true forensic system the actual bytes
  need somewhere to live (S3 / R2 / IPFS with content addressing).
  The hash currently in the database is computed over the finding
  text, not over real file bytes — that's a marketing-grade lie
  we should fix before anyone tries to use this for a serious
  case.
- **PDF / DOCX export of admissible reports.** Markdown renders
  in-app; PDF is Tier 3 premium.

---

## 3. Who would actually use this?

### 1. Boutique OSINT investigation firms (10-50 analysts)

**Today**: Maltego Pro seats ($1.8k/seat/year) + Hunchly ($14/mo)
+ shared spreadsheet for case tracking + email for handoffs.

**With forenix-oss**: one workflow, one audit chain, one repo per
case. Self-hosted. MIT-licensed core.

**Why they'd switch**: cost (especially Maltego). Provenance
they can show in court. Tool output captured automatically.

**Why they might not**: trust. They're not going to trust a
1-developer 6-month-old project with cases that have real legal
consequences. We earn that the hard way — published audits,
referenceable cases, eventually a Tier 3 with SOC 2.

### 2. Incident-response teams at MSSPs

**Today**: Velociraptor / Hayabusa for endpoint forensics, a
separate threat-intel platform (OpenCTI / MISP) for context, an
internal wiki for case write-ups.

**With forenix-oss**: their threat-intel + OSINT enrichment +
case write-up live on one chain.

**Why they'd switch**: integration is the bottleneck. Today they
manually paste IoCs into MISP, manually copy reports into wiki.
forenix-oss does the agent-pipeline → evidence promotion → SAT-
backed report in one click.

**Why they might not**: it doesn't replace Velociraptor for the
endpoint side. It's an addition, not a substitute. That's a
slower sales motion.

### 3. Investigative journalists + journalist collectives
*(Bellingcat-style)*

**Today**: Hunchly subscriptions, shared Drive, Google Docs for
final writeups, Signal for coordination.

**With forenix-oss**: the audit chain becomes the editorial
trail. Every "we know X because Y" claim is tied to a specific
tool output captured at a specific time.

**Why they'd switch**: when stories get sued, the chain becomes
exculpatory evidence. Bellingcat-style claims already appear in
ICC filings — the standard of "show your work" is rising fast.

**Why they might not**: this isn't a journalism tool. They want
collaborative editing first, audit chain second. We're inverted
from their priorities.

### 4. Public-defender + civil-rights legal teams

**Today**: paper. Or PDFs in Dropbox.

**With forenix-oss**: a way to capture publicly-available
counter-evidence (defendant's social posts disproving prosecution
timeline, etc.) with an audit chain that survives the rules-of-
evidence challenge.

**Why they'd switch**: cost, again. The commercial alternatives
(Relativity, EnCase) are firmly enterprise-priced.

**Why they might not**: they don't have the technical capacity
to self-host. They need a managed offering — that's Tier 3.

### 5. Academics studying intelligence analysis

**Today**: hand-built case studies, manual SAT application,
papers about why analysts don't use SATs.

**With forenix-oss**: an instrumented platform where analyst
behaviour can be studied at scale. Coulthart's body of work is
about *why* analysts don't use SATs in practice. We could give
that field a tool that surfaces SAT usage automatically.

**Why they'd care**: this is the academic angle of the project.
You explicitly named this as a research artefact (Phase F is the
paper).

---

## 4. Where it's weaker than it sounds

Being uncomfortably specific:

1. **The LLM is still the bottleneck for quality.** Real tools +
   SAT-grounded prompting + real evidence make the LLM's output
   *checkable*. They don't make it correct. A 70B model running
   ACH over four hypotheses still picks the wrong one sometimes.
   What we've done is make the wrongness *visible* — the
   reviewing analyst can see the disconfirming-evidence column
   and disagree with the weight assignment in 30 seconds.

2. **The "real Git" claim is true but understated.** Right now
   we have a real Git repo per case with real commits and real
   merges. We do **not** have real file-bytes in those commits
   yet — every evidence record is its own JSON file holding
   metadata + a content hash. That's still better than the
   metadata-only commit table we had pre-Phase-A, and it's a
   single Phase 8 task to add the bytes (R2 / S3 / IPFS upload
   + content-addressed storage + a hash that's genuinely over
   bytes-on-disk). Until that ships, the platform is
   "chain-of-custody for narrative" — not "chain-of-custody for
   raw files".

3. **Workspace isolation is per-team, not per-org.** Teams
   model exists; orgs don't. Two teams in the same deployment
   can be visually separated but a determined admin could
   walk between them. Tier 3 puts an `orgId` discriminator one
   layer above Team and enforces row-level scoping in Postgres.

4. **The audit chain proves no-tampering, not authorship.** A
   row tells you *that* `verify_finding` happened on that
   `entityId` at that timestamp. It tells you the *actor*
   (`userId`) but the actor is whatever the JWT said. SSO + MFA
   close that loop. SaaS premium.

5. **We haven't field-tested with a real case.** Every screenshot
   in the docs is seeded data. The platform has never investigated
   a real target end-to-end with a real analyst. The next ~30
   days should be: pick one design-partner firm, give them a free
   self-host, watch them try.

6. **The OSS tools we bundle vary in quality.** sherlock has a
   well-documented false-positive problem on services that return
   200 for `/user/<anything>`. theHarvester's reliability depends
   on which sources you toggle. Real analysts know to chase down
   each hit; the platform should make that easier by surfacing
   per-tool confidence (which it already does via the SatTrace
   credibility field — but only if the LLM populates it
   honestly).

---

## 5. The honest summary

forenix-oss is a *defensible chain-of-custody system over an
LLM-orchestrated OSINT pipeline*. Each of those words is now
genuinely true after Phases A–E:

- **defensible** — the audit chain is verifiable offline; the Git
  history is independently inspectable.
- **chain-of-custody** — every state change is captured on the
  chain; every evidence record carries a hash + a real Git commit.
- **LLM-orchestrated** — the LLM is invoked with real tools and
  picks which to run, constrained by SAT-grounded prompting.
- **OSINT pipeline** — the seven agent groups + 10 real tools
  cover the headline workflow.

**What it isn't yet:**

- A replacement for EnCase / AXIOM (no real file-byte handling).
- A real-time collaborative platform (no websockets).
- A field-validated product (zero real-case usage).
- A SOC-2 attested system (that's Tier 3, and it requires the
  org isolation + SSO + audit-log retention work).

**Is it worth running on a real case today?** Yes, for #1, #2, #3
above (boutique investigators, MSSP IR, journalists) **if** they
treat the file-byte hashing limitation explicitly — i.e. if they
also keep the raw bytes in their existing storage and the
forenix-oss hash is supplementary attestation, not the primary
custody record. With that caveat, the platform makes their
workflow auditable in a way nothing else open-source does today.

**Is it worth the academic paper?** Yes. The contribution isn't
"we built another LLM agent" — it's "we operationalised SAT-
grounded prompting on top of OSINT tool calls with a
cryptographically-attested chain". That's a publishable claim
because the SAT-evaluation literature (Coulthart, Heuer, Pherson,
RAND) is mostly about why analysts *don't* use SATs in practice.
forenix-oss is a proposal for *how* you might force them to —
not by training, but by making the platform refuse to emit a
finding without one.
