# Research questions enabled by the artefact

forenix-oss was built so the following four questions could be
investigated empirically, not only conceptually. Each is framed
with the literature gap it addresses; full citations are in
[`bibliography.md`](bibliography.md).

The questions are intentionally complementary. A single doctoral
programme would typically pursue one as a primary contribution and
draw on the others as supporting analysis.

---

## RQ1. Cross-jurisdictional governance for admissibility

**Question.** What governance framework should constrain OSINT
pipelines that aim for legal admissibility, and how does that
framework vary across jurisdictions with materially different
evidence rules?

**The gap.** The intelligence-studies literature on OSINT
(Akhgar et al. 2017; Pastor-Galindo et al. 2020) is engineering-
oriented and treats admissibility as out of scope. The
information-law literature on data governance (Bygrave 2014;
Scassa 2018, 2020) treats OSINT pipelines as one application
domain among many and does not develop framework-level
prescriptions for them. The Berkeley Protocol (2020) supplies
investigative-procedure guidance for human-rights contexts but
does not engage with the divergence in evidence rules between
Canadian, EU, and US jurisdictions, and is silent on the
algorithmic and platform-specific questions a software pipeline
raises.

**Why the artefact is needed.** A governance framework that
cannot be implemented in working software cannot be tested. The
platform allows a candidate framework to be encoded as
configuration (which tools may run, against which targets, under
which legal authorisations, with which retention windows) and the
resulting outputs scored against admissibility criteria in mock
or live proceedings.

**What an empirical contribution would look like.** A formal
framework, plus its encoded implementation in the platform, plus
case-study evaluations in at least two of {Canada under PIPEDA
and the Canada Evidence Act, EU under GDPR and Evidence
Regulation 2020/1783, US under Federal Rules of Evidence and the
post-*Carpenter* doctrine}.

---

## RQ2. Operationalising structured analytic techniques in code

**Question.** Can structured analytic techniques (SATs) be
operationalised in code without losing their epistemic function?

**The gap.** Coulthart's 2017 evidence-based evaluation of the 12
core SATs is rigorous about which techniques actually reduce
cognitive bias when performed by humans (KAC and ACH come out
well; quality-of-information checks come out poorly). The same
study is silent on whether the same techniques retain their
corrective power when performed by software, in particular by
large language models that themselves exhibit confirmation bias
and anchoring (Bommasani et al. 2021; Weidinger et al. 2022). The
question is non-trivial: an LLM asked to "perform an Analysis of
Competing Hypotheses" may produce text that follows the
procedural form of ACH while inheriting the same biases the
technique was designed to counter.

**Why the artefact is needed.** The platform requires every LLM-
produced finding to carry a SAT trace (see
[`docs/10-ANALYTIC_FRAMEWORK.md`](../10-ANALYTIC_FRAMEWORK.md)).
This produces a corpus of paired (human-baseline, LLM-with-SAT,
LLM-without-SAT) outputs that can be evaluated against the same
metrics Coulthart applied to human SAT use: did the technique
shift the analytic conclusion when applied? Did it surface
hypotheses the analyst would otherwise have suppressed? Did it
reduce overconfidence in the final assessment?

**What an empirical contribution would look like.** A reproducible
experimental protocol for evaluating software-performed SATs,
applied to at least two of the 12 core techniques (ACH and KAC
are the natural candidates given their strong human-baseline
results), against a corpus of OSINT cases drawn from publicly
documented investigations.

---

## RQ3. Rights-protective design constraints by default

**Question.** What rights-protective design constraints should be
built into OSINT tooling by default, and what is the legal status
of each constraint under PIPEDA, GDPR, and the post-*Carpenter*
Fourth-Amendment doctrine?

**The gap.** "Privacy by design" (Cavoukian 2009) and "data
protection by design and by default" (GDPR Article 25) are
established at the principle level. Their operational meaning for
OSINT pipelines is contested. Should a default-configured pipeline
refuse to query breach corpora absent a documented legal basis?
Should it apply Carpenter-style protection to commercially-
available location data even where US doctrine has not (yet)
required it? Should retention windows be hard-coded or
configurable? Each of these is a design question with a legal
answer, and the legal answer differs by jurisdiction.

**Why the artefact is needed.** A platform that ships with these
constraints implemented has standing to evaluate them. A
configuration that refuses to query a particular source absent an
explicit legal-basis declaration is testable: it can be enforced,
audited via the SHA-256 chain, and contested in concrete cases.
Without the implementation, the conversation remains at the level
of guidance documents that real pipelines are free to ignore.

**What an empirical contribution would look like.** A taxonomy of
candidate constraints, each implemented as a configuration of the
platform, each evaluated for legal status under the three named
doctrines, and each assessed in case-study deployments for its
operational cost (how many otherwise-legitimate investigations
the constraint blocked or slowed).

---

## RQ4. Cryptographic chain of custody and evidence rules

**Question.** How do cryptographic chain-of-custody primitives
(forward hash chains, transparency logs, cosigned attestations)
interact with existing evidence rules across jurisdictions? Do
they strengthen admissibility, are they treated as ordinary
metadata, or does their cryptographic character create new
categories of expert-witness contest?

**The gap.** The forensic-evidence literature (Casey 2011; Mason
and Seng 2017) is grounded in pre-cryptographic chain-of-custody
practice: a paper trail of handlers, signed receipts, physical
evidence bags. The transparency-log literature (Laurie et al.
2013; Newman et al. 2022; Crosby and Wallach 2009) is technically
mature but engages with admissibility only in passing. Courts
have had limited occasion to rule on cryptographic chain-of-
custody artefacts; where they have, the doctrine is unsettled and
varies by jurisdiction.

**Why the artefact is needed.** forenix-oss persists every action
through a forward-linked SHA-256 chain and supports publication
of chain roots to three independent transparency backends (local
HMAC, GitHub-issue witness, Sigstore Rekor). A researcher can
take the same case, generate the same evidence artefact under
each backend, and present each in mock proceedings to evaluate
how the backend choice affects evidentiary weight and expert-
witness contest.

**What an empirical contribution would look like.** A doctrinal
analysis paired with empirical case studies (mock proceedings,
preferably with sitting or recently-retired judges and counsel)
evaluating how the three backend categories are treated under
each of the three named jurisdictions' evidence rules. A
secondary contribution: design recommendations for the next
generation of transparency-log primitives oriented to forensic
use.

---

## How a doctoral programme would use these

A typical pathway:

1. **Year 1.** Refine the primary question (one of RQ1-RQ4),
   complete coursework if required, draft and defend the proposal.
   Engage with the platform as a user; identify the case studies
   to be run.

2. **Years 2-3.** Run case studies; collect empirical data;
   develop the framework or taxonomy that constitutes the primary
   contribution. Publish two or three peer-reviewed papers as
   intermediate outputs.

3. **Year 4.** Synthesise into the dissertation; defend.

The platform is mature enough today that a candidate would not
spend doctoral years building the apparatus. The apparatus is
done; the research is what runs on it.

---

## Adjacent questions the platform also enables

These are not the four primary questions but are within reach
given the artefact:

- Comparative analysis of free-tier LLM adapters as Director
  models for OSINT pipelines (mock, Ollama-local, GLM, OpenRouter,
  NVIDIA, Groq are all wired and swap by configuration).
- The economics of self-hosted vs hosted OSINT: at what scale
  does running the full subprocess toolchain locally pay off
  against per-call API costs to commercial OSINT vendors.
- Detection-evasion dynamics: how the design constraints in RQ3
  interact with adversarial targets attempting to detect or
  poison OSINT collection against them.
- Methodology for replicating closed-source intelligence-agency
  pipelines in the open, and the policy implications of doing so.

Each of these is an interesting question. None of them is the
primary thesis the artefact was built to support; the four above
are.
