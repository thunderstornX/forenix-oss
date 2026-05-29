/**
 * RQ2 evaluation — labelled cases + the baseline (ungrounded) prompt.
 *
 * RQ2 (RESEARCH.md §3): does grounding the analyst in Structured
 * Analytic Techniques (+ disconfirmation weighting) measurably improve
 * its OSINT reasoning vs. an ungrounded baseline?
 *
 * The two conditions differ ONLY in the system prompt:
 *   - "sat"      → the product's SAT-grounded prompt (sat-prompts.ts)
 *   - "baseline" → a plain analyst prompt, same output schema, no SAT
 *                  scaffold, no SatTrace, no disconfirmation weighting.
 * Tools are disabled in both, so we measure the *prompt's* effect on
 * reasoning rather than a confound of differing tool-call sequences.
 *
 * Ground truth is restricted to PUBLIC entities with independently
 * verifiable facts (Wikipedia / official sites) — no live private
 * individuals, in keeping with the platform's rights posture.
 */
import type { AgentGroup } from "@/lib/ai/types";

export type Condition = "sat" | "baseline";

export interface EvalCase {
  id: string;
  target: string;
  agentGroup: AgentGroup;
  /** Key facts a competent analyst should surface. Recall is measured
   *  against these; they are not exhaustive. */
  groundTruth: string[];
  notes?: string;
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "archive-identity",
    target: "archive.org (the Internet Archive)",
    agentGroup: "identity",
    groundTruth: [
      "The Internet Archive was founded by Brewster Kahle.",
      "The Internet Archive was founded in 1996.",
      "archive.org is operated by the Internet Archive, a registered non-profit.",
      "The Internet Archive is headquartered in San Francisco, California.",
    ],
    notes: "Public non-profit; facts verifiable via Wikipedia / archive.org.",
  },
  {
    id: "archive-infrastructure",
    target: "archive.org (the Internet Archive)",
    agentGroup: "infrastructure",
    groundTruth: [
      "archive.org serves content from a large storage/CDN system known as petabox.",
      "archive.org operates many subdomains (e.g. audio streaming and dev/QA hosts).",
      "archive.org's public site is a modern JavaScript single-page application.",
      "archive.org is served over HTTPS.",
    ],
    notes: "Infrastructure facts corroborated by the seeded archive.org case study.",
  },
  {
    id: "eff-identity",
    target: "eff.org (the Electronic Frontier Foundation)",
    agentGroup: "identity",
    groundTruth: [
      "The Electronic Frontier Foundation (EFF) was founded in 1990.",
      "EFF's founders include John Gilmore, John Perry Barlow, and Mitch Kapor.",
      "EFF is a non-profit digital civil-liberties / digital-rights organisation.",
      "EFF is based in San Francisco, California.",
    ],
    notes: "Public non-profit; facts verifiable via Wikipedia / eff.org.",
  },
];

/**
 * The baseline (ungrounded) system prompt: a competent OSINT analyst
 * with NO SAT scaffold and NO structured SatTrace — but the SAME
 * findings JSON schema, so the product's parser reads it unchanged.
 */
export function baselinePromptFor(group: AgentGroup): string {
  return `You are an OSINT ${group} analyst. Investigate the target and report what you can establish about it from public information.

RULES:
- Only assert things you are confident are true. Do not invent specifics (names, dates, numbers) you are unsure of.
- Output STRICT JSON only — no markdown fences, no preamble — matching:
{
  "findings": [
    {
      "title": string,
      "description": string,
      "confidence": "confirmed" | "probable" | "unverified" | "disputed" | "false",
      "priority": "low" | "medium" | "high" | "critical",
      "sourceName": string,
      "reasoningTrace": string
    }
  ],
  "confidence": number
}
Produce 2-5 findings.`;
}
