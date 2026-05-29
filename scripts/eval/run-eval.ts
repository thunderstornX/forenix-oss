#!/usr/bin/env bun
/**
 * RQ2 evaluation harness — runner.
 *
 *   bun run scripts/eval/run-eval.ts            # full pilot
 *   EVAL_TRIALS=1 bun run scripts/eval/run-eval.ts   # quick smoke
 *
 * For each case × condition (sat | baseline) × trial, it drives the
 * product pipeline (tools disabled, prompt swapped) on the SUT model,
 * has the judge score the findings, and aggregates:
 *   - recall            : known facts the analyst surfaced
 *   - hallucination     : findings the judge marked incorrect
 *   - correct-rate      : findings that matched / were verifiably true
 *   - calibration gap   : mean confidence(correct) − mean confidence(incorrect)
 *
 * Writes a raw results JSON + a human report (docs/research/rq2-pilot-results.md).
 *
 * Needs GROQ_API_KEY (SUT) + OPENROUTER_API_KEY (judge) in the env.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chatAnalyzePipeline } from "@/lib/ai/chat-completions";
import type { Finding } from "@/lib/ai/types";

import { EVAL_CASES, baselinePromptFor, type Condition, type EvalCase } from "./cases";
import { judgeRun, type JudgeVerdict } from "./judge";
import { sutBackend, sleep } from "./llm";

const TRIALS = Math.max(1, Number(process.env.EVAL_TRIALS ?? 3));
const CONDITIONS: Condition[] = ["baseline", "sat"];
const CONF_NUM: Record<string, number> = {
  confirmed: 1, probable: 0.7, unverified: 0.35, disputed: 0.2, false: 0,
};

interface RunRecord {
  caseId: string;
  condition: Condition;
  trial: number;
  findings: Array<{ title: string; description: string; confidence: string }>;
  verdict: JudgeVerdict;
  error?: string;
}

async function analyse(c: EvalCase, condition: Condition): Promise<Finding[]> {
  const res = await chatAnalyzePipeline(sutBackend(), c.target, c.agentGroup, [], {
    disableTools: true,
    systemPrompt: condition === "baseline" ? baselinePromptFor(c.agentGroup) : undefined,
  });
  return res.findings;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await sleep(4000); // back off once (rate limits, transient 5xx)
    return await fn();
  }
}

async function main() {
  const sut = sutBackend().model;
  console.log(`RQ2 pilot — SUT=${sut}, conditions=${CONDITIONS.join("/")}, trials=${TRIALS}\n`);
  const runs: RunRecord[] = [];

  for (const c of EVAL_CASES) {
    for (const condition of CONDITIONS) {
      for (let trial = 1; trial <= TRIALS; trial++) {
        const tag = `${c.id}/${condition}/#${trial}`;
        try {
          const findings = await withRetry(() => analyse(c, condition));
          const verdict = await withRetry(() => judgeRun(c, findings));
          runs.push({
            caseId: c.id,
            condition,
            trial,
            findings: findings.map((f) => ({
              title: f.title, description: f.description, confidence: f.confidence,
            })),
            verdict,
          });
          const recall = pct(verdict.factsFound.filter(Boolean).length, verdict.factsFound.length);
          const halluc = verdict.findingVerdicts.filter((v) => v === "incorrect").length;
          console.log(`  ${tag.padEnd(34)} findings=${findings.length} recall=${recall}% incorrect=${halluc}`);
        } catch (e) {
          runs.push({ caseId: c.id, condition, trial, findings: [], verdict: { factsFound: [], findingVerdicts: [] }, error: (e as Error).message });
          console.log(`  ${tag.padEnd(34)} ERROR: ${(e as Error).message.slice(0, 80)}`);
        }
        await sleep(1500); // be gentle with free-tier rate limits
      }
    }
  }

  const summary = aggregate(runs);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(join("scripts", "eval", "results"), { recursive: true });
  const jsonPath = join("scripts", "eval", "results", `rq2-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify({ sut, trials: TRIALS, generatedAt: new Date().toISOString(), summary, runs }, null, 2));

  const report = renderReport(sut, summary);
  writeFileSync(join("docs", "research", "rq2-pilot-results.md"), report);

  console.log(`\n── summary ──`);
  for (const cond of CONDITIONS) {
    const s = summary.byCondition[cond];
    console.log(`  ${cond.padEnd(9)} recall=${s.recall}%  halluc=${s.hallucinationRate}%  correct=${s.correctRate}%  calib=${s.calibrationGap}`);
  }
  console.log(`\nwrote ${jsonPath}\nwrote docs/research/rq2-pilot-results.md`);
}

// ── aggregation ────────────────────────────────────────────────────

interface CondSummary {
  recall: number; hallucinationRate: number; correctRate: number;
  calibrationGap: number; avgFindings: number; n: number;
}
interface Summary {
  byCondition: Record<Condition, CondSummary>;
  perCase: Array<{ caseId: string; baseline: CondSummary; sat: CondSummary }>;
}

function aggregate(runs: RunRecord[]): Summary {
  const byCondition = {} as Record<Condition, CondSummary>;
  for (const cond of CONDITIONS) byCondition[cond] = summarise(runs.filter((r) => r.condition === cond));
  const ids = [...new Set(runs.map((r) => r.caseId))];
  const perCase = ids.map((id) => ({
    caseId: id,
    baseline: summarise(runs.filter((r) => r.caseId === id && r.condition === "baseline")),
    sat: summarise(runs.filter((r) => r.caseId === id && r.condition === "sat")),
  }));
  return { byCondition, perCase };
}

function summarise(runs: RunRecord[]): CondSummary {
  const ok = runs.filter((r) => !r.error);
  const recall = mean(ok.map((r) => ratio(r.verdict.factsFound.filter(Boolean).length, r.verdict.factsFound.length)));
  const halluc = mean(ok.map((r) => ratio(r.verdict.findingVerdicts.filter((v) => v === "incorrect").length, r.verdict.findingVerdicts.length)));
  const correct = mean(ok.map((r) => ratio(r.verdict.findingVerdicts.filter((v) => v === "correct").length, r.verdict.findingVerdicts.length)));
  const avgFindings = mean(ok.map((r) => r.findings.length));

  const confCorrect: number[] = [], confIncorrect: number[] = [];
  for (const r of ok) {
    r.verdict.findingVerdicts.forEach((v, i) => {
      const cn = CONF_NUM[r.findings[i]?.confidence ?? "unverified"] ?? 0.35;
      if (v === "correct") confCorrect.push(cn);
      else if (v === "incorrect") confIncorrect.push(cn);
    });
  }
  const calibrationGap = round2((mean(confCorrect) || 0) - (mean(confIncorrect) || 0));

  return {
    recall: round1(recall * 100), hallucinationRate: round1(halluc * 100),
    correctRate: round1(correct * 100), calibrationGap, avgFindings: round1(avgFindings), n: ok.length,
  };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const pct = (a: number, b: number) => Math.round(ratio(a, b) * 100);

// ── report ─────────────────────────────────────────────────────────

function renderReport(sut: string, s: Summary): string {
  const b = s.byCondition.baseline, t = s.byCondition.sat;
  const row = (label: string, base: number, sat: number) =>
    `| ${label} | ${base} | ${sat} | ${sat - base > 0 ? "+" : ""}${round1(sat - base)} |`;
  return `# RQ2 pilot — does SAT-grounding improve OSINT reasoning?

_Auto-generated by \`scripts/eval/run-eval.ts\`. **Directional pilot — not a verdict.**_

**RQ2** (RESEARCH.md §3): can Structured Analytic Techniques (Heuer-Pherson /
Coulthart) + disconfirmation weighting measurably improve the LLM analyst's
OSINT reasoning vs. an ungrounded baseline?

**Design.** Same model, same inputs, **tools disabled** — the *only* difference
is the system prompt (\`baseline\` plain analyst vs \`sat\` the product's
SAT-grounded prompt). SUT = \`${sut}\`; judge = a different model (OpenRouter);
${s.perCase.length} public-entity cases × ${round1(b.n / Math.max(1, s.perCase.length))} trials/condition.

> ⚠️ **How to read this.** The numbers are a *directional* signal from a tiny
> run, and this regime is **confounded**: with tools disabled, both conditions
> emit vague-but-true generic findings, and the SAT prompt — which is built to
> *gather evidence, then* apply ACH/disconfirmation — correctly hedges to
> "unverified" when it has no evidence to reason over. So a low SAT recall here
> reflects the **missing-evidence regime**, not weaker reasoning. The fair test
> needs a tool-enabled (or evidence-provided) arm — one flag away
> (\`disableTools: false\`). Do **not** cite this as "SAT is worse."

## Overall (mean across cases × trials)

| Metric | baseline | sat | Δ (sat − baseline) |
|---|---|---|---|
${row("Recall of known facts (%)", b.recall, t.recall)}
${row("Hallucination rate (%)", b.hallucinationRate, t.hallucinationRate)}
${row("Correct-finding rate (%)", b.correctRate, t.correctRate)}
${row("Calibration gap (conf_correct − conf_incorrect)", b.calibrationGap, t.calibrationGap)}
${row("Avg findings / run", b.avgFindings, t.avgFindings)}

Higher recall / correct-rate / calibration-gap is better; lower hallucination is better.

## Per case

| Case | recall b→sat | halluc b→sat | correct b→sat |
|---|---|---|---|
${s.perCase.map((c) => `| ${c.caseId} | ${c.baseline.recall}→${c.sat.recall}% | ${c.baseline.hallucinationRate}→${c.sat.hallucinationRate}% | ${c.baseline.correctRate}→${c.sat.correctRate}% |`).join("\n")}

## Caveats (pilot)

- Small N and a handful of public-entity cases — directional signal, not a
  powered result. Expand cases + trials before any claim.
- LLM-as-judge (different model from the SUT to limit self-preference bias);
  a manual-validation subset should backstop the judge before publication.
- Tools disabled to isolate the prompt's effect on reasoning; a tool-enabled
  arm is a separate experiment.
- Pre-registration intent per RESEARCH.md §10: fix this protocol + metrics
  before scaling the run.
`;
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e); process.exit(1); },
);
