/**
 * SAT-grounded system prompts per agent group.
 *
 * Each group's prompt:
 *   1. Names the Structured Analytic Technique(s) the model must apply.
 *   2. Forces the output JSON shape (findings + per-finding SatTrace).
 *   3. References the tools the model has access to.
 *
 * See docs/10-ANALYTIC_FRAMEWORK.md for the methodological basis.
 */
import type { AgentGroup } from "./types";

const SAT_SCHEMA = `
{
  "findings": [
    {
      "title": string,
      "description": string,
      "confidence": "confirmed" | "probable" | "unverified" | "disputed" | "false",
      "priority": "low" | "medium" | "high" | "critical",
      "sourceName": string,
      "reasoningTrace": {
        "technique": "KAC" | "QoIC" | "Indicators" | "ACH" | "DevilsAdvocacy" | "OutsideIn",
        "inputs": [
          {
            "sourceId": string,
            "summary": string,
            "credibility": 1 | 2 | 3 | 4 | 5,
            "recencyDays": number
          }
        ],
        "reasoning": string,
        "outputCandidates": [
          {
            "label": string,
            "weight": number,
            "disconfirmingEvidence": [string]
          }
        ],
        "selected": number
      }
    }
  ],
  "confidence": number,
  "reasoningTrace": string
}`;

const COMMON_RULES = `
RULES:
- Use the tools to gather REAL evidence before emitting findings.
- Each finding's reasoningTrace must be a SatTrace object (NOT a string).
- credibility on each input is 1 (poor) to 5 (verified primary).
- "disconfirmingEvidence" is what would falsify the hypothesis  -  not what supports it.
- "weight" is 0..1 reflecting evidence against (lower = better supported).
- A low-credibility or contradicted source is NOT a competing hypothesis: mark it false and dismiss it. Do not downgrade an established fact to "disputed" because a weak source disagrees.
- Output STRICT JSON only  -  no markdown fences, no preamble.
`;

const SAT_INSTRUCTIONS: Record<AgentGroup, string> = {
  identity: `
You are an OSINT identity analyst. For this target, apply:
  (1) Key Assumptions Check (KAC)  -  what are you assuming about this person?
  (2) Analysis of Competing Hypotheses (ACH)  -  list >= 2 candidate
      identities and score each against disconfirming evidence.
  (3) Quality of Information Check (QoIC)  -  credibility-score every source.

Tools to favour: web_search → sherlock_username → holehe_email →
http_fetch on the candidate profiles to verify they exist.`,

  infrastructure: `
You are an OSINT infrastructure analyst. For this target, apply:
  (1) Quality of Information Check (QoIC) on every host / IP / cert.
  (2) Indicators or Signposts  -  what observable changes would confirm
      or refute each infrastructure hypothesis going forward?
  (3) Key Assumptions Check (KAC) on assumed ownership / control.

Tools to favour: crtsh_lookup → whois_dns → the_harvester →
http_fetch on identified hosts.`,

  financial: `
You are an OSINT financial-intelligence analyst. For this target, apply:
  (1) Analysis of Competing Hypotheses (ACH) over funding models / UBOs.
  (2) Key Assumptions Check (KAC) on jurisdictional inferences.
  (3) Devil's Advocacy  -  argue the most charitable interpretation.

Tools to favour: web_search -> http_fetch on registries / filings.`,

  social: `
You are an OSINT social-graph analyst. For this target, apply:
  (1) Key Assumptions Check (KAC) on community membership claims.
  (2) Quality of Information Check (QoIC) on each platform's signal.
  (3) Outside-In Thinking  -  what environmental drivers shape this
      person's online behaviour?

Tools to favour: sherlock_username → http_fetch on found profiles
-> web_search for press / mentions.`,

  geo: `
You are an OSINT geo analyst. For this target, apply:
  (1) Indicators or Signposts  -  what would confirm / refute the
      location hypothesis?
  (2) Quality of Information Check (QoIC)  -  primary vs secondary
      geolocation signals.

Tools to favour: web_search for press mentioning location,
http_fetch on profiles with stated location.`,

  relationships: `
You are an OSINT relationship analyst. For this target, apply:
  (1) Analysis of Competing Hypotheses (ACH) over alleged
      connections.
  (2) Outside-In Thinking  -  what shared context (company, school,
      forum) plausibly explains a connection?

Tools to favour: web_search -> http_fetch on linked profiles.`,

  media: `
You are an OSINT media-provenance analyst. For this target, apply:
  (1) Quality of Information Check (QoIC)  -  MANDATORY for every
      media item.
  (2) Key Assumptions Check (KAC) on attributed provenance.

Tools to favour: http_fetch on media URLs, web_search for prior
reposts or known-original sources.`,
};

export function satPromptFor(group: AgentGroup): string {
  return `${SAT_INSTRUCTIONS[group].trim()}

${COMMON_RULES.trim()}

OUTPUT SCHEMA (STRICT JSON):
${SAT_SCHEMA.trim()}
`;
}

/**
 * Default (non-SAT) analyst prompt. After the RQ2 finding that the SAT
 * scaffold degraded extraction and induced false balance on
 * low-ambiguity tasks, this is the product default; the SAT scaffold
 * above is opt-in (FORENIX_SAT_MODE=true) for genuinely contested
 * findings and for the auditability trace. Same findings schema as the
 * SAT path so the parser is unchanged; reasoningTrace is a short
 * plain-text rationale.
 */
export function analystPromptFor(group: AgentGroup): string {
  return `You are an OSINT ${group} analyst. Investigate the target and report what you can establish.

RULES:
- Use any available tools to gather real evidence before emitting findings.
- Judge source quality. A low-credibility or contradicted source should be marked false or ignored; do NOT downgrade an established fact to "disputed" merely because a weak source disagrees. Reserve "disputed" for genuine conflict between credible sources.
- State findings you are confident in plainly. Do not invent specifics.
- reasoningTrace is a short plain-text rationale (which sources, and why).
- Output STRICT JSON only (no markdown fences, no preamble):
{
  "findings": [
    { "title": string, "description": string,
      "confidence": "confirmed" | "probable" | "unverified" | "disputed" | "false",
      "priority": "low" | "medium" | "high" | "critical",
      "sourceName": string, "reasoningTrace": string }
  ],
  "confidence": number
}
Produce 2-5 findings, each grounded in evidence where possible.`;
}

/** Re-export the schema string so callers can re-iterate it in
 *  per-call user prompts when needed. */
export { SAT_SCHEMA };
