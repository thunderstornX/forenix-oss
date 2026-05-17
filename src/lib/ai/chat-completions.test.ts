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

  // ----- Hardening tests (regressions for v0.2.0 monster-mode bugs) -----

  it("stops at the matching close brace, ignoring trailing prose", () => {
    const raw = '{"findings":[{"title":"a"}]} Hope this helps! :)';
    expect(extractJson<unknown>(raw)).toEqual({
      findings: [{ title: "a" }],
    });
  });

  it("ignores braces inside string literals", () => {
    const raw = '{"text": "this } looks like a closer but isn\'t"}';
    expect(extractJson<unknown>(raw)).toEqual({
      text: "this } looks like a closer but isn't",
    });
  });

  it("repairs a trailing comma before a closing brace", () => {
    const raw = '{"findings":[{"title":"a"},{"title":"b"},]}';
    expect(extractJson<unknown>(raw)).toEqual({
      findings: [{ title: "a" }, { title: "b" }],
    });
  });

  it("repairs a trailing comma before a closing bracket", () => {
    const raw = '[1, 2, 3,]';
    expect(extractJson<unknown>(raw)).toEqual([1, 2, 3]);
  });

  it("throws with a descriptive message when there is no JSON opener", () => {
    try {
      extractJson<unknown>("the model failed to comply");
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("no JSON opener");
    }
  });

  it("handles an array as the top-level container with prose after", () => {
    const raw = '[{"a":1},{"b":2}]\n\n--end of analysis--';
    expect(extractJson<unknown>(raw)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("handles deeply nested objects without false-positive closers", () => {
    const raw = '{"a":{"b":{"c":{"d":42}}}, "e": [1,{"f":2}]}';
    expect(extractJson<unknown>(raw)).toEqual({
      a: { b: { c: { d: 42 } } },
      e: [1, { f: 2 }],
    });
  });

  it("handles escaped quotes inside strings", () => {
    const raw = '{"q": "she said \\"hi\\""}';
    expect(extractJson<unknown>(raw)).toEqual({ q: 'she said "hi"' });
  });

  it("handles consecutive backslashes inside strings", () => {
    const raw = '{"p": "a\\\\b"}';
    expect(extractJson<unknown>(raw)).toEqual({ p: "a\\b" });
  });
});
