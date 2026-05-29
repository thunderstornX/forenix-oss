/**
 * LLM-as-judge scorer for the RQ2 harness.
 *
 * Given a case's ground-truth facts + the analyst's findings, the
 * judge returns, per known fact, whether the findings established it
 * (→ recall), and per finding, whether it's correct / plausible /
 * incorrect (→ hallucination + precision). A different model from the
 * SUT does the grading (see llm.ts). The harness validates a manual
 * subset on top — the judge is an instrument, not an oracle.
 */
import type { Finding } from "@/lib/ai/types";

import type { EvalCase } from "./cases";
import { judgeBackend, rawChat } from "./llm";

export type FindingVerdict = "correct" | "plausible" | "incorrect";

export interface JudgeVerdict {
  factsFound: boolean[]; // aligned to case.groundTruth
  findingVerdicts: FindingVerdict[]; // aligned to findings
}

export async function judgeRun(c: EvalCase, findings: Finding[]): Promise<JudgeVerdict> {
  const facts = c.groundTruth.map((f, i) => `  [${i}] ${f}`).join("\n");
  const fs =
    findings
      .map((f, i) => `  [${i}] (${f.confidence}) ${f.title}: ${f.description}`.slice(0, 400))
      .join("\n") || "  (none)";

  const system =
    "You are a rigorous, impartial evaluator of OSINT analyst output. " +
    "Judge strictly against the provided known facts and widely-established public knowledge. Return strict JSON only.";

  const user = `TARGET: ${c.target}

KNOWN TRUE FACTS (ground truth, in order):
${facts}

ANALYST FINDINGS (in order):
${fs}

Task 1 — factsFound: for EACH known fact (same order), did the analyst's findings establish it? true / false.
Task 2 — findingVerdicts: for EACH finding (same order), classify:
  "correct"   = matches a known fact, or is verifiably true of this target;
  "plausible" = not among the known facts but reasonable and NOT contradicted;
  "incorrect" = contradicted by a known fact, or a fabricated/false claim.

Return STRICT JSON only:
{"factsFound": [${c.groundTruth.map(() => "true|false").join(", ")}], "findingVerdicts": [${findings.map(() => '"correct"|"plausible"|"incorrect"').join(", ")}]}`;

  const raw = await rawChat(
    judgeBackend(),
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { json: true },
  );
  return parseVerdict(raw, c.groundTruth.length, findings.length);
}

/** Parse the judge's JSON defensively; pad/truncate to expected lengths. */
function parseVerdict(raw: string, nFacts: number, nFindings: number): JudgeVerdict {
  let obj: { factsFound?: unknown; findingVerdicts?: unknown } = {};
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    obj = JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw) as typeof obj;
  } catch {
    /* fall through to defaults */
  }

  const facts = Array.isArray(obj.factsFound) ? obj.factsFound : [];
  const verdicts = Array.isArray(obj.findingVerdicts) ? obj.findingVerdicts : [];

  const factsFound: boolean[] = Array.from({ length: nFacts }, (_, i) => facts[i] === true);
  const findingVerdicts: FindingVerdict[] = Array.from({ length: nFindings }, (_, i) => {
    const v = verdicts[i];
    return v === "correct" || v === "incorrect" || v === "plausible" ? v : "plausible";
  });

  return { factsFound, findingVerdicts };
}
