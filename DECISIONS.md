# Decision record

Short, dated notes on non-obvious project decisions and the evidence behind them.

## 2026-05-30: Lead with the custody guarantee, not "court-admissible"

**Decision.** The headline framing now leads with what the system provably
delivers, a tamper-evident, audit-ready chain of custody, rather than
"court-admissible evidence."

**Why.** Admissibility is a legal and procedural determination (jurisdiction,
rules of evidence, authentication, the analyst's competence, often expert
testimony). A SHA-256 forward-chained audit log and three attestation backends
deliver integrity and tamper-evidence, which is real and verifiable, but they
do not by themselves make evidence admissible. Leading with "court-admissible"
over-claims to exactly the conservative audience (DFIR, litigation, due
diligence) most likely to catch it. "Tamper-evident, audit-ready, built for
evidentiary use" is the honest and still strong claim.

**Scope.** Wording only, on the lead surfaces (README, CITATION, repository
description). The custody, attestation, audit-chain, and case-management
engine is unchanged.

## 2026-05-30: Structured Analytic Techniques are opt-in, not the default

**Decision.** The SAT-grounded prompt is now opt-in behind
`FORENIX_SAT_MODE=true`. The default analyst prompt does plain extraction with
an explicit source-quality judgement. The `SatTrace` schema and the
verification-view rendering are kept, as an optional auditability layer.

**Why.** A controlled evaluation (`scripts/eval/`, RESEARCH.md RQ2) compared the
SAT-grounded prompt against a plain baseline on the same model with the same
inputs. On low-ambiguity OSINT extraction the SAT scaffold underperformed:
lower recall, fewer findings, and a specific failure mode. Its
disconfirmation-weighting treated a planted low-quality source as a legitimate
competing hypothesis and downgraded established facts to "disputed" (false
balance), where the baseline simply dismissed the bad source. This is
consistent with the evaluative SAT literature, which finds the evidence for
SATs improving analytic *accuracy* mixed at best; their documented value is in
*process*: transparency, auditability, and explicit treatment of uncertainty.

**So.** SATs are retained for the role they actually fit on this project, an
auditability and defensibility record on contested findings, not as an accuracy
mechanism applied to every extraction. The COMMON_RULES were also patched so a
low-credibility or contradicted source is dismissed rather than weighted, which
addresses the false-balance bug directly.

**Reversible.** Set `FORENIX_SAT_MODE=true` to restore SAT grounding as the
default. The evaluation should be re-run on the production model (larger, with
tools, on genuinely ambiguous targets such as contested identity attribution)
before treating the negative result as general; the false-balance mechanism,
however, is a design issue worth keeping fixed regardless.

## 2026-05-30: Paid SaaS shelved; forenix is OSS plus a live demo

**Decision.** The paid-SaaS commercial tier (billing, SSO, SOC 2,
multi-tenant selling) is no longer pursued. forenix is positioned as an
open-source platform and a research artifact, with one hosted instance
(demo.forenix.tech) serving as a live demo and a research deployment.

**Why.** No validated demand (no customer discovery, negligible waitlist), a
conservative and crowded market for evidentiary tooling, and the commercial
layer is the largest unbuilt piece with the least evidence of payoff. The
achievable, bounded win is the research (RQ2) plus the open-source and
portfolio value. A product is an open-ended commitment; a study is a finite
deliverable.

**Scope.** Documentation and framing only. No code removed. The multi-tenant
schema, the private overlay, `SAAS_MODE`, and the hosted deployment all
remain, repurposed for the demo and for ecologically-valid research runs. If
real demand appears later, the plumbing is already in place.
