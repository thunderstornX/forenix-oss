/**
 * Pure-function tests for the OpenAI-compatible adapter helpers.
 * No network  -  we just exercise the JSON-extraction / shape-cleaning
 * code paths that every real adapter relies on.
 */
import { describe, it, expect } from "bun:test";

import { extractJson } from "./chat-completions";

describe("chat-completions/extractJson", () => {
  it("parses a plain JSON object", () => {
    expect(extractJson<unknown>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a plain JSON array", () => {
    expect(extractJson<unknown>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("strips ```json fences", () => {
    const raw = "```json\n{\"findings\":[]}\n```";
    expect(extractJson<unknown>(raw)).toEqual({ findings: [] });
  });

  it("strips plain ``` fences", () => {
    const raw = "```\n{\"x\":\"y\"}\n```";
    expect(extractJson<unknown>(raw)).toEqual({ x: "y" });
  });

  it("skips a prose preamble before the first brace", () => {
    const raw = "Sure! Here is the JSON you asked for:\n\n{\"ok\":true}";
    expect(extractJson<unknown>(raw)).toEqual({ ok: true });
  });

  it("works on nested objects", () => {
    const raw = '{"findings":[{"title":"x","confidence":"probable"}]}';
    expect(extractJson<unknown>(raw)).toEqual({
      findings: [{ title: "x", confidence: "probable" }],
    });
  });

  it("throws on totally non-JSON input", () => {
    expect(() => extractJson<unknown>("this is not json at all")).toThrow();
  });

  it("handles leading whitespace + fence + trailing prose", () => {
    const raw = "   \n  ```json\n[1,2]\n```\n\nfin.";
    expect(extractJson<unknown>(raw)).toEqual([1, 2]);
  });
});
