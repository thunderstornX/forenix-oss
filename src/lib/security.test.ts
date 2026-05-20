/**
 * Tests for src/lib/security.ts.
 *
 * Validates correctness — the constant-time guarantee itself isn't
 * something we can assert in a unit test (would need a statistical
 * timing harness). What we can assert: equal strings match,
 * non-matching strings don't, length mismatches are rejected,
 * empties are rejected, and the bearer header parser handles the
 * known input shapes.
 */
import { describe, it, expect } from "bun:test";

import { bearerFromHeader, timingSafeStringEqual } from "./security";

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeStringEqual("hello", "hello")).toBe(true);
    expect(timingSafeStringEqual("a".repeat(64), "a".repeat(64))).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(timingSafeStringEqual("hello", "world")).toBe(false);
    expect(timingSafeStringEqual("aaaa", "aaab")).toBe(false);
  });

  it("returns false for different lengths (no exception)", () => {
    expect(timingSafeStringEqual("short", "muchlonger")).toBe(false);
    expect(timingSafeStringEqual("a", "")).toBe(false);
    expect(timingSafeStringEqual("", "a")).toBe(false);
  });

  it("returns false for empty inputs", () => {
    expect(timingSafeStringEqual("", "")).toBe(false);
    expect(timingSafeStringEqual("", "abc")).toBe(false);
  });

  it("handles unicode correctly", () => {
    expect(timingSafeStringEqual("café", "café")).toBe(true);
    expect(timingSafeStringEqual("café", "cafe")).toBe(false);
  });
});

describe("bearerFromHeader", () => {
  const make = (auth: string | null) =>
    new Request("https://example.com/", {
      headers: auth === null ? {} : { authorization: auth },
    });

  it("strips the Bearer prefix", () => {
    expect(bearerFromHeader(make("Bearer abc123"))).toBe("abc123");
    expect(bearerFromHeader(make("bearer abc123"))).toBe("abc123");
    expect(bearerFromHeader(make("BEARER abc123"))).toBe("abc123");
  });

  it("returns a bare token unchanged", () => {
    expect(bearerFromHeader(make("abc123"))).toBe("abc123");
  });

  it("handles missing header", () => {
    expect(bearerFromHeader(make(null))).toBe("");
  });

  it("handles surrounding whitespace", () => {
    expect(bearerFromHeader(make("  Bearer   abc123  "))).toBe("abc123");
  });
});
