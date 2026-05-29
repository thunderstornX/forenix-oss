import { describe, expect, test } from "bun:test";

import { coerceTrace, serialiseTrace } from "./sat-trace";

const valid = {
  technique: "ACH",
  inputs: [{ sourceId: "holehe:foo@bar.com", summary: "exists", credibility: 4, recencyDays: 30 }],
  reasoning: "Candidate identity scored against disconfirming evidence.",
  outputCandidates: [
    { label: "Alice", weight: 0.2, disconfirmingEvidence: ["no matching profile photo"] },
    { label: "Bob", weight: 0.8, disconfirmingEvidence: [] },
  ],
  selected: 0,
};

describe("coerceTrace: valid + normalised", () => {
  test("accepts a well-formed SatTrace", () => {
    const c = coerceTrace(valid);
    expect(c.kind).toBe("sat");
  });

  test("clamps weight to 0..1 and credibility to 1..5", () => {
    const c = coerceTrace({
      ...valid,
      inputs: [{ sourceId: "x", summary: "y", credibility: 99, recencyDays: -5 }],
      outputCandidates: [{ label: "A", weight: 7, disconfirmingEvidence: [] }],
    });
    expect(c.kind).toBe("sat");
    if (c.kind !== "sat") throw new Error("expected sat");
    expect(c.trace.inputs[0]!.credibility).toBe(5);
    expect(c.trace.inputs[0]!.recencyDays).toBe(0);
    expect(c.trace.outputCandidates[0]!.weight).toBe(1);
  });

  test("clamps selected into the candidate range", () => {
    const c = coerceTrace({ ...valid, selected: 17 });
    if (c.kind !== "sat") throw new Error("expected sat");
    expect(c.trace.selected).toBe(1); // 2 candidates -> max index 1
  });
});

describe("coerceTrace: invalid + text", () => {
  test("flags an unknown technique as invalid", () => {
    const c = coerceTrace({ ...valid, technique: "Vibes" });
    expect(c.kind).toBe("invalid");
    if (c.kind !== "invalid") throw new Error("expected invalid");
    expect(c.error).toContain("technique");
  });

  test("flags an object with no technique as invalid", () => {
    expect(coerceTrace({ error: "boom" }).kind).toBe("invalid");
  });

  test("passes legacy free text through", () => {
    const c = coerceTrace("just some prose reasoning");
    expect(c.kind).toBe("text");
    if (c.kind !== "text") throw new Error("expected text");
    expect(c.text).toBe("just some prose reasoning");
  });

  test("parses a JSON string of a SatTrace", () => {
    expect(coerceTrace(JSON.stringify(valid)).kind).toBe("sat");
  });
});

describe("serialiseTrace", () => {
  test("round-trips a valid trace to normalised JSON", () => {
    const s = serialiseTrace(valid);
    const back = JSON.parse(s) as { technique: string };
    expect(back.technique).toBe("ACH");
  });

  test("emits an _invalidSatTrace marker for a broken trace", () => {
    const s = serialiseTrace({ technique: "nope" });
    const back = JSON.parse(s) as { _invalidSatTrace?: boolean };
    expect(back._invalidSatTrace).toBe(true);
  });

  test("empty / null trace serialises to an empty string", () => {
    expect(serialiseTrace(null)).toBe("");
    expect(serialiseTrace(undefined)).toBe("");
  });
});
