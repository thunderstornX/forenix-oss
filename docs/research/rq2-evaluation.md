# RQ2 evaluation harness

Operationalises **RQ2** (see [`../../RESEARCH.md`](../../RESEARCH.md) §3):

> Can structured analytic techniques (Heuer-Pherson / Coulthart) +
> disconfirmation weighting measurably improve an LLM analyst's OSINT
> reasoning, versus an ungrounded baseline?

This turns the platform's central design claim into something *measurable*
rather than asserted. It is a research instrument, not a product feature —
it lives in `scripts/eval/` and never runs in the live pipeline.

## What it does

For each **case** × **condition** × **trial**, it drives the real product
pipeline (`chatAnalyzePipeline`) on a system-under-test (SUT) model, then a
**different** model (the judge) scores the output against curated ground truth.

The two conditions differ in **exactly one thing — the system prompt**:

| Condition | Prompt |
|---|---|
| `baseline` | a plain OSINT-analyst prompt (`scripts/eval/cases.ts`), same output schema, no SAT scaffold, no SatTrace, no disconfirmation weighting |
| `sat` | the product's SAT-grounded prompt (`src/lib/ai/sat-prompts.ts`) |

Everything else (model, inputs, parsing, judge) is held constant, so any
difference is attributable to the prompt.

## Metrics

- **Recall** — of a case's curated ground-truth facts, how many the analyst surfaced.
- **Hallucination rate** — findings the judge marks *incorrect* (contradicted / fabricated).
- **Correct-finding rate** — findings that match a known fact or are verifiably true.
- **Calibration gap** — mean confidence(correct) − mean confidence(incorrect); a well-calibrated analyst is more confident on the findings it gets right.

## Ground truth

Public entities with independently verifiable facts only (Wikipedia / official
sites) — e.g. the Internet Archive, the EFF. **No live private individuals**,
in keeping with the platform's rights posture. Cases live in
`scripts/eval/cases.ts`; the seeded `case-studies/archive-org-data.json`
provides corroboration for the archive.org case.

## Running it

```bash
# needs GROQ_API_KEY (SUT) + OPENROUTER_API_KEY (judge) in the env
bun run scripts/eval/run-eval.ts            # full pilot (3 trials)
EVAL_TRIALS=1 bun run scripts/eval/run-eval.ts   # quick smoke
```

Knobs (env): `EVAL_TRIALS`, `EVAL_SUT_MODEL`, `EVAL_JUDGE_MODEL`. Output: a
raw results JSON under `scripts/eval/results/` + a human report at
`docs/research/rq2-pilot-results.md` (both git-ignored — they are regenerated
run artifacts, not source).

## Two regimes — and the pilot's lesson

By default the pilot runs with **tools disabled** (`disableTools: true`) to
isolate the prompt's effect on the model's *own* reasoning. The first pilot
runs showed this regime is **confounded**: with no tools, both conditions emit
vague-but-true generic findings, and the SAT prompt — which is built to
*gather evidence, then* apply ACH/disconfirmation — correctly hedges to
`unverified` when it has nothing to reason over. Single-trial numbers also
swing widely (SAT recall flipped 0% → 25% between identical runs), i.e. N=1 is
noise.

**So the instrument immediately earned its keep**, by showing that a fair RQ2
answer needs:

1. a **tool-enabled** (or fixed-evidence-provided) arm — flip `disableTools`
   to `false`, so the SAT prompt has evidence to reason over;
2. **many more trials + cases** for signal over LLM stochasticity;
3. a **manual-validation subset** behind the LLM-judge before any claim;
4. **pre-registration** of this protocol + metrics (RESEARCH.md §10) before the
   scaled run.

The harness supports all of this; the pilot's role was to prove the pipeline
and surface the design constraints — which it did.
