/**
 * Pure-function tests for the github attestation backend's envelope
 * codec. The HTTP path is exercised live by the route + manual smoke
 * test  -  we only test the pure JSON wrap/unwrap here.
 */
import { describe, expect, it } from "bun:test";

import { buildBody, extractEnvelope, type CodecHead } from "./github-codec";

function head(): CodecHead {
  return {
    entries: 7,
    headId: "ckxxx",
    headHash: "c".repeat(64),
    attestedAt: new Date("2026-05-17T13:00:00.000Z"),
  };
}

describe("attestation/backends/github envelope codec", () => {
  it("buildBody emits markdown-wrapped JSON with our schema marker", () => {
    const body = buildBody(head());
    expect(body).toContain("```json");
    expect(body).toContain("\"forenix_attestation\": 1");
    expect(body).toContain("\"entries\": 7");
    expect(body).toContain("c".repeat(64));
  });

  it("extractEnvelope round-trips a body built by buildBody", () => {
    const env = extractEnvelope(buildBody(head()));
    expect(env).not.toBeNull();
    expect(env!.forenix_attestation).toBe(1);
    expect(env!.entries).toBe(7);
    expect(env!.headId).toBe("ckxxx");
    expect(env!.headHash).toBe("c".repeat(64));
  });

  it("extractEnvelope returns null for unrelated comment bodies", () => {
    expect(extractEnvelope("just a regular comment")).toBeNull();
    expect(extractEnvelope("```python\nprint('hi')\n```")).toBeNull();
  });

  it("extractEnvelope returns null when the JSON is malformed", () => {
    const bad = "```json\n{ not valid json }\n```";
    expect(extractEnvelope(bad)).toBeNull();
  });

  it("extractEnvelope rejects a json block without our schema marker", () => {
    const other = "```json\n{\"some_other_thing\":true}\n```";
    expect(extractEnvelope(other)).toBeNull();
  });

  it("extractEnvelope tolerates the user editing surrounding prose", () => {
    const wrapped = [
      "# attestations log",
      "",
      "*added some commentary above*",
      "",
      buildBody(head()),
      "",
      "*and some below*",
    ].join("\n");
    const env = extractEnvelope(wrapped);
    expect(env).not.toBeNull();
    expect(env!.headHash).toBe("c".repeat(64));
  });
});
