# Case studies

Two case studies have been run end-to-end against the deployed
instance of forenix-oss at demo.forenix.tech. This document
records the methodology, the configuration, the measured outputs,
and the rendered admissible artefacts. The intent is that a
researcher reading [`../../RESEARCH.md`](../../RESEARCH.md) can
inspect concrete empirical evidence of the platform's behaviour
rather than taking the claims on trust.

Both case studies were chosen because their targets are
themselves public infrastructure with no expectation of privacy
in the data collected, and because both targets have well-
documented public records that allow the platform's findings to
be cross-validated against secondary sources.

---

## Case study 1: Sigstore (`sigstore.dev`)

**Objective.** Map public infrastructure of sigstore.dev
(subdomains, certificate-transparency-log presence, hosting).
Cross-reference against the Rekor transparency log that the
platform itself uses as one of its attestation backends. The
goal was a clean inventory of where the Sigstore project lives
on the public internet plus a sanity check that the platform's
own attestation chain integrates with the project's public log.

**Configuration.**

| Parameter | Value |
|---|---|
| Investigation id | `cmpehnovb0001ab2kz5fub8vy` |
| Target type | domain |
| Agent groups | `identity`, `infrastructure` |
| LLM adapter | `openrouter` |
| Model | `openai/gpt-oss-120b:free` via OpenRouter |
| Adapter defaults | temperature, top-p, max-tokens as set in `src/lib/ai/adapters/openrouter.ts` at the commit recorded in the investigation row |
| Run window | 2026-05-20 20:02 UTC to 2026-05-21 00:24 UTC (with one mid-run failure that surfaced the pipeline-runner reliability bug now fixed in commit `d5c8b66`) |

**Measured outputs.**

| Measure | Count |
|---|---|
| Findings persisted | 5 |
| Findings by confidence | `confirmed` 2, `probable` 2, `unverified` 1 |
| Unique entities extracted | 9 |
| Entity relations | 11 |
| Audit-log entries linked to this investigation | 11 (pipeline start, per-agent-group completion, entity extraction, report generation, bridge-to-case, plus the prior failed-run sequence preserved in the chain) |
| LLM-produced summary report | 3,441 characters, persisted as a `Report` row |
| Forensic case opened | `CASE-2026-003`, `cmper13so001jabex5n3xywp2` |
| Evidence rows promoted from findings | 5 |
| Admissible PDF rendered | 5 pages, [`case-studies/sigstore-case.pdf`](case-studies/sigstore-case.pdf) |
| Raw structured data | [`case-studies/sigstore-data.json`](case-studies/sigstore-data.json) (full investigation, findings, entities, relations, reports, and audit subset) |

**Findings produced (titles only).** Full content is in the
admissible PDF.

1. *Identity pipeline returned unstructured output* (the platform
   stored this as `unverified` and surfaced it to the operator;
   see the methodological note below)
2. *Sigstore.dev primary infrastructure hosted on Google Cloud*
3. *Rekor transparency log service is publicly reachable*
4. *Sigstore blog and documentation hosted on GitHub Pages via
   Fastly CDN*
5. *Domain ownership linked to Google-managed project (sigstore)*

**Methodological note on the unverified finding.** The
`identity` agent group's output for this run did not conform to
the structured-finding schema. The platform recorded this
explicitly: the finding is persisted with confidence
`unverified` and a title that names the conformance failure.
The conclusion is preserved in the chain so the operator can
inspect it, but its confidence is not upgraded. This is the
SAT-discipline behaviour described in
[`../10-ANALYTIC_FRAMEWORK.md`](../10-ANALYTIC_FRAMEWORK.md)
section 4: epistemic weakness is recorded rather than smoothed
away.

**Cross-validation.** Each `confirmed` finding was checkable
against public secondary sources: Sigstore's GCP hosting is
documented in the project's public deployment manifests; the
Rekor public endpoint is documented in the Sigstore
specification; Fastly CDN attribution is verifiable via DNS and
HTTP-response-header inspection. The platform's findings matched
secondary-source ground truth in every case it asserted
confidence.

---

## Case study 2: Internet Archive (`archive.org`)

**Objective.** Map the public infrastructure and recent security-
incident exposure of Internet Archive. The September 2024 and
October 2025 incidents at Internet Archive are well-documented in
the public record. The goal was a forensic-grade case file
(timeline, evidence inventory, chain-of-custody-attested report)
demonstrating end-to-end use of the platform for incident-
retrospective work.

**Configuration.**

| Parameter | Value |
|---|---|
| Investigation id | `cmpehrpfs0001ab5pww3dtgms` |
| Target type | domain |
| Agent groups | `identity`, `infrastructure` |
| LLM adapter | `openrouter` |
| Model | `openai/gpt-oss-120b:free` via OpenRouter |
| Adapter defaults | temperature, top-p, max-tokens as set in `src/lib/ai/adapters/openrouter.ts` at the commit recorded in the investigation row |
| Run window | 2026-05-20 20:05 UTC, single run, no failure |

**Measured outputs.**

| Measure | Count |
|---|---|
| Findings persisted | 11 |
| Findings by confidence | `confirmed` 4, `probable` 6, `unverified` 1 |
| Unique entities extracted | 14 |
| Entity relations | 12 |
| Audit-log entries linked to this investigation | 14 |
| LLM-produced reports | 2 (one summary report from the pipeline, one bridged case report attached to the forensic case) |
| Forensic case opened | `CASE-2026-002`, `cmpeigafg0000abuvfy8y320p` |
| Evidence rows promoted from findings | 11 |
| Admissible PDF rendered | 6 pages, [`case-studies/archive-org-case.pdf`](case-studies/archive-org-case.pdf) |
| Raw structured data | [`case-studies/archive-org-data.json`](case-studies/archive-org-data.json) (full investigation, findings, entities, relations, reports, and audit subset) |

**Findings produced (titles only).** Full content is in the
admissible PDF.

1. *Domain Ownership*
2. *Key Personnel Email Pattern*
3. *Archive.org hosts audio streaming subdomains*
4. *Identity pipeline returned unstructured output*
   (`unverified`, same SAT-discipline behaviour as in case study
   1)
5. *Archive.org runs internal development and QA environments
   under subdomains*
6. *Archive.org's public web presence is served via a modern
   React front-end*
7. *Internet Archive Founder* (`confirmed`, references public
   record)
8. *Archive.org operates a large petabox CDN infrastructure*
   (`confirmed`, references public engineering documentation)
9. *Archive.org operates a large, centrally-managed subdomain
   ecosystem* (`confirmed`)
10. *Analytics subdomain is self-hosted on the same stack*
    (`probable`)
11. *Audio subdomains are load-balanced endpoints for the Wayback
    Machine* (`probable`)

**Cross-validation.** As in case study 1, every `confirmed`
finding is independently verifiable against the Internet
Archive's public engineering documentation, the public DNS
record, and the project's open-source repositories on GitHub.
The `probable` findings carry weaker independent evidence but
none contradict the public record.

---

## What both case studies establish

These two runs are early-stage demonstrations, not formal
evaluations. They establish four things:

1. **The apparatus runs.** The platform completes the full
   pipeline (analyse, extract entities, generate report, bridge
   to case, render admissible PDF) end to end against live
   public targets with no operator intervention beyond
   initialisation.

2. **The audit chain holds.** Both investigations produced a
   contiguous SHA-256 forward-chained audit trail. Both chains
   pass the offline-verification recipe in
   [`../07-SECURITY.md`](../07-SECURITY.md) section 4.

3. **The SAT discipline activates.** Both runs surfaced the
   same epistemic-quality issue (the `identity` agent group's
   output not conforming to the structured-finding schema), and
   in both cases the platform persisted the rejection as a
   visible `unverified` finding rather than silently dropping or
   silently upgrading it. This is the designed behaviour of the
   SAT scaffold from [`../10-ANALYTIC_FRAMEWORK.md`](../10-ANALYTIC_FRAMEWORK.md).

4. **The admissible artefact renders.** Both case files produced
   a Playwright-rendered PDF report, bound to a forensic case
   with chain-of-custody attestation, ready for use as a
   demonstrative exhibit. Both PDFs are committed alongside this
   document for inspection.

---

## What the case studies do not establish

These early demonstrations do not measure:

- The platform's behaviour against admissibility criteria in any
  particular jurisdiction (this is RQ1 in
  [`research-questions.md`](research-questions.md))
- The epistemic effectiveness of the SAT scaffold relative to
  baseline LLM output (RQ2)
- The platform's compliance posture under PIPEDA, GDPR, or US
  doctrine when targeting individuals rather than public
  infrastructure (RQ3)
- The behaviour of the cryptographic chain-of-custody artefacts
  in actual or mock proceedings (RQ4)

Each of these is the subject of dedicated empirical work to
follow. The two case studies above establish that the apparatus
is fit for use as the substrate for that work.

---

## Replicating these case studies

The full replication path is in [`REPLICATION.md`](REPLICATION.md).
A local replay against the mock adapter will exercise the same
code paths and produce the same shape of output, though the
specific findings will differ (the mock adapter is
deterministic but does not call out to a real LLM). For a
realistic replay, configure `AI_ADAPTER=openrouter` plus an
`OPENROUTER_API_KEY` and re-run the `scripts/init.ts`
bootstrap against the same targets.
