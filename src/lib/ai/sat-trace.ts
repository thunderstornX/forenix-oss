/**
 * SatTrace validation + normalisation.
 *
 * The SAT-grounded prompt (sat-prompts.ts) asks the model to attach a
 * structured `reasoningTrace` (a SatTrace) to every finding. Models
 * being models, they drift: an unknown technique, a weight of 7, a
 * `selected` index past the end, inputs as a bare string, etc.
 *
 * Before v this was stored verbatim (`JSON.stringify`), so the
 * Verification view rendered whatever garbage came back — or silently
 * nothing. This module is the gate: a structurally-sound trace is
 * normalised (weights clamped to 0..1, credibility to 1..5, `selected`
 * into range) and stored clean; a broken one is replaced with an
 * explicit `_invalidSatTrace` marker the UI can flag, rather than
 * pretending it's a valid analytic record.
 *
 * `technique` is the one strict field — an unrecognised technique is a
 * real analytic error, so it invalidates the whole trace. Everything
 * else is coerced/clamped, because minor sloppiness shouldn't bin an
 * otherwise-usable reasoning record.
 */
import { z } from "zod";

export const SAT_TECHNIQUES = [
  "KAC",
  "QoIC",
  "Indicators",
  "ACH",
  "DevilsAdvocacy",
  "OutsideIn",
] as const;
export type SatTechnique = (typeof SAT_TECHNIQUES)[number];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (fallback: number) => z.coerce.number().catch(fallback);
const str = (max: number) =>
  z.coerce.string().catch("").transform((s) => s.slice(0, max));

const SatInput = z.object({
  sourceId: str(400),
  summary: str(2000),
  credibility: num(3).transform((n) => clamp(Math.round(n), 1, 5)),
  recencyDays: num(0).transform((n) => Math.max(0, Math.round(n))),
});

const SatCandidate = z.object({
  label: str(400),
  weight: num(0.5).transform((n) => clamp(n, 0, 1)),
  disconfirmingEvidence: z
    .array(z.coerce.string())
    .catch([])
    .transform((a) => a.slice(0, 8).map((s) => s.slice(0, 800))),
});

export const SatTraceSchema = z.object({
  // Strict: an unknown technique invalidates the trace.
  technique: z.enum(SAT_TECHNIQUES),
  inputs: z.array(SatInput).catch([]).transform((a) => a.slice(0, 12)),
  reasoning: str(4000),
  outputCandidates: z.array(SatCandidate).catch([]).transform((a) => a.slice(0, 8)),
  selected: num(0).transform((n) => Math.max(0, Math.round(n))),
});
export type SatTrace = z.infer<typeof SatTraceSchema>;

export type CoercedTrace =
  | { kind: "sat"; trace: SatTrace }
  | { kind: "text"; text: string }
  | { kind: "invalid"; error: string; raw: string };

/** Marker persisted when a structured trace fails validation. */
export interface InvalidSatTrace {
  _invalidSatTrace: true;
  error: string;
  raw: string;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Classify + normalise whatever the model put on `reasoningTrace`. */
export function coerceTrace(input: unknown): CoercedTrace {
  if (input === null || input === undefined) return { kind: "text", text: "" };

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("{")) {
      try {
        return coerceTrace(JSON.parse(trimmed));
      } catch {
        /* not JSON after all — treat as free text */
      }
    }
    return { kind: "text", text: input.slice(0, 4000) };
  }

  if (typeof input === "object") {
    const result = SatTraceSchema.safeParse(input);
    if (result.success) {
      const trace = result.data;
      // `selected` is cross-field — clamp it into the candidate range.
      trace.selected =
        trace.outputCandidates.length > 0
          ? clamp(trace.selected, 0, trace.outputCandidates.length - 1)
          : 0;
      return { kind: "sat", trace };
    }
    return {
      kind: "invalid",
      error: result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .slice(0, 4)
        .join("; "),
      raw: safeStringify(input).slice(0, 800),
    };
  }

  return { kind: "text", text: String(input).slice(0, 800) };
}

/**
 * Serialise a reasoning trace for the `Finding.reasoningTrace` column.
 * Always returns a string: normalised SatTrace JSON, plain free text,
 * or an `_invalidSatTrace` marker JSON.
 */
export function serialiseTrace(input: unknown): string {
  const c = coerceTrace(input);
  if (c.kind === "text") return c.text;
  if (c.kind === "sat") return safeStringify(c.trace).slice(0, 4000);
  const marker: InvalidSatTrace = { _invalidSatTrace: true, error: c.error, raw: c.raw };
  return safeStringify(marker).slice(0, 4000);
}
