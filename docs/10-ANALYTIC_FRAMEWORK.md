# Analytic Framework

> Why forenix-oss isn't just an LLM that hallucinates plausible
> findings  -  and how we're going to enforce that.

This document is also the platform's scholarly anchor for the
structured-analytic-technique literature (Heuer 1999; Heuer and
Pherson 2010+; Coulthart 2017). Readers approaching forenix-oss
as a research artefact rather than as a tool should pair this
document with [`../RESEARCH.md`](../RESEARCH.md) for the wider
research framing and [`research/bibliography.md`](research/bibliography.md)
for full citations.

## 1. The Director-Worker pattern (OpenClaw heritage)

The OSINT execution model mirrors the
[openclaw-osint-stalker](https://github.com/lidorshimoni/openclaw-osint-stalker)
plugin's split:

```
┌───────────────────────────────────────────────────────────────┐
│   Director (LLM, per agent group)                              │
│   ── decides which tools to invoke, in what order              │
│   ── reasons over tool output                                  │
│   ── produces a SAT-grounded finding                           │
└──────────┬────────────────────────────────────────────────────┘
           │ tool calls (function-calling protocol)
           ▼
┌───────────────────────────────────────────────────────────────┐
│   Worker pool                                                  │
│   ── runs subprocess tools (Maigret, Sherlock, Holehe, ...)      │
│   ── runs HTTP-API tools (Shodan, Censys, Hunter, IntelX, ...)   │
│   ── returns structured results                                │
└───────────────────────────────────────────────────────────────┘
```

**Self-host deployments** run the worker pool as a local subprocess
inside the same container.

**Vercel deployments** can't shell out to subprocesses; instead they
make HTTP calls to a worker service. For the demo, that worker can
be the user's own laptop, exposed via a cloudflared / ngrok tunnel
and pinned via the `WORKER_URL` env. When the laptop is offline the
Director gracefully degrades to API-only tools.

## 2. Structured Analytic Techniques (Coulthart / Heuer / Pherson)

The LLM Director is not allowed to produce free-form output. Every
finding must carry a **SAT trace**  -  a structured record of which
analytic technique was applied, what hypotheses were considered,
and what evidence supports each one.

### The 12 core techniques

Source: CIA *Tradecraft Primer* (April 2009), Heuer & Pherson
(2010+), and Stephen Coulthart's evaluative work at the SUNY
Albany OSI Lab.

#### Diagnostic  -  make reasoning transparent

1. **Key Assumptions Check (KAC)**  -  surface every assumption the
   analysis rests on, then test whether each one still holds.
2. **Quality of Information Check (QoIC)**  -  score each source on
   credibility, accuracy, and recency before it informs a finding.
3. **Indicators or Signposts of Change**  -  name the observable
   events that would confirm or refute each hypothesis going
   forward.
4. **Analysis of Competing Hypotheses (ACH)**  -  enumerate every
   plausible explanation, score each piece of evidence against each
   hypothesis, weight by *disconfirmation* not confirmation.

#### Contrarian  -  challenge current thinking

5. **Devil's Advocacy**  -  argue the strongest case against the
   dominant view.
6. **Team A / Team B Analysis**  -  partition reviewers into
   adversarial teams arguing opposing positions.
7. **High-Impact / Low-Probability Analysis**  -  examine tail-risk
   scenarios that consensus dismisses.
8. **"What If?" Analysis**  -  invert the conclusion and reason
   backwards.

#### Imaginative  -  alternatives and futures

9. **Structured Brainstorming**  -  facilitator-led divergent
   ideation.
10. **Outside-In Thinking**  -  start from environmental drivers, not
    the target.
11. **Red Team Analysis**  -  adopt the adversary's perspective.
12. **Alternative Futures Analysis**  -  sketch multiple plausible
    end-states.

### Mapping SATs to agent groups

| Agent group | Required SATs before a finding is emitted |
|---|---|
| `identity` | **KAC** (assumptions about this person), **ACH** (which identity hypothesis best fits?), **QoIC** |
| `infrastructure` | **QoIC**, **Indicators**, **KAC** |
| `financial` | **ACH**, **KAC**, **Devil's Advocacy** |
| `social` | **KAC**, **QoIC**, **Outside-In Thinking** |
| `geo` | **Indicators**, **QoIC** |
| `relationships` | **ACH**, **Outside-In Thinking** |
| `media` | **QoIC** (mandatory  -  provenance is everything in media), **KAC** |

### The output contract

Every finding carries a structured trace on
`Finding.reasoningTrace` (parsed as JSON):

```ts
interface SatTrace {
  technique:
    | "KAC" | "QoIC" | "Indicators" | "ACH"
    | "DevilsAdvocacy" | "TeamAB" | "HighImpact" | "WhatIf"
    | "Brainstorming" | "OutsideIn" | "RedTeam" | "AlternativeFutures";

  inputs: Array<{
    sourceId: string;       // e.g. "shodan:host:1.2.3.4" or "sherlock:reddit:foo"
    summary: string;
    credibility: 1 | 2 | 3 | 4 | 5;
    recencyDays: number;
  }>;

  reasoning: string;

  outputCandidates: Array<{
    label: string;          // hypothesis or assumption
    weight: number;         // 0..1  -  disconfirmation-weighted, not confirmation
    disconfirmingEvidence: string[];
  }>;

  selected: number;         // index into outputCandidates
}
```

The Verification view renders this directly  -  the analyst sees the
ACH matrix, the KAC list, and the QoIC source-scoring inline,
exactly as the LLM produced them.

## 3. Why this matters

Without SAT-grounded prompting, a 70B LLM with tool use will still
do what every LLM does: produce confident-sounding prose that may
or may not survive a court challenge. With it, every finding comes
with the analytic technique the analyst would have used by hand  - 
which is exactly what makes the output admissible.

This is the layer that turns *"an AI did some OSINT"* into
*"a human-comparable analytic record"*.

## 4. References

- Heuer, Richards J. Jr. & Pherson, Randolph H. *Structured
  Analytic Techniques for Intelligence Analysis*, 3rd ed. CQ
  Press, 2020.
- CIA. *A Tradecraft Primer: Structured Analytic Techniques for
  Improving Intelligence Analysis*. April 2009.
  <https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf>
- Coulthart, Stephen J. ["Why do analysts use structured analytic
  techniques? An in-depth study of an American intelligence
  agency."](https://www.researchgate.net/publication/297677662)
  *Intelligence and National Security*, 2016.
- Coulthart, Stephen J. ["An Evidence-Based Evaluation of 12 Core
  Structured Analytic Techniques."](https://www.researchgate.net/publication/313486005)
  *International Journal of Intelligence and CounterIntelligence*, 2017.
- RAND. ["Assessing the Value of Structured Analytic Techniques in
  the U.S. Intelligence
  Community."](https://www.rand.org/content/dam/rand/pubs/research_reports/RR1400/RR1408/RAND_RR1408.pdf) 2016.
- OpenClaw OSINT Stalker. <https://github.com/lidorshimoni/openclaw-osint-stalker>
