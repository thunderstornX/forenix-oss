/**
 * Pure-function tests for the cadence parser.
 * Same pattern as the audit-chain tests  -  zero Prisma, zero
 * network, just maths.
 */
import { describe, it, expect } from "bun:test";

import {
  CadenceError,
  computeNextRun,
  isDue,
  parseCadence,
} from "./cadence";

const FIXED = new Date("2026-05-18T12:00:00.000Z");

describe("cadence parser", () => {
  it("parses named shortcuts", () => {
    expect(parseCadence("hourly").intervalMs).toBe(60 * 60 * 1000);
    expect(parseCadence("daily").intervalMs).toBe(24 * 60 * 60 * 1000);
    expect(parseCadence("weekly").intervalMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseCadence("monthly").intervalMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("preserves the named label but normalises the canonical form", () => {
    const p = parseCadence("daily");
    expect(p.label).toBe("daily");
    expect(p.canonical).toBe("every:1d");
  });

  it("parses every:N(m|h|d) syntax", () => {
    expect(parseCadence("every:5m").intervalMs).toBe(5 * 60 * 1000);
    expect(parseCadence("every:6h").intervalMs).toBe(6 * 60 * 60 * 1000);
    expect(parseCadence("every:3d").intervalMs).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("is case-insensitive + trims whitespace", () => {
    expect(parseCadence("  WEEKLY ").intervalMs).toBe(parseCadence("weekly").intervalMs);
    expect(parseCadence("Every:10M").intervalMs).toBe(parseCadence("every:10m").intervalMs);
  });

  it("rejects empty + nonsense input", () => {
    expect(() => parseCadence("")).toThrow(CadenceError);
    expect(() => parseCadence("   ")).toThrow(CadenceError);
    expect(() => parseCadence("sometimes")).toThrow(CadenceError);
    expect(() => parseCadence("every:abc")).toThrow(CadenceError);
    expect(() => parseCadence("every:5x")).toThrow(CadenceError);
    expect(() => parseCadence("every:0m")).toThrow(CadenceError);
    expect(() => parseCadence("every:-5m")).toThrow(CadenceError);
  });

  it("enforces a 1-minute floor", () => {
    expect(() => parseCadence("every:0m")).toThrow(CadenceError);
    // 1 minute is the minimum and must parse:
    expect(parseCadence("every:1m").intervalMs).toBe(60 * 1000);
  });

  it("enforces a 90-day ceiling", () => {
    expect(() => parseCadence("every:91d")).toThrow(CadenceError);
    // 90 days is the maximum and must parse:
    expect(parseCadence("every:90d").intervalMs).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("computeNextRun adds the interval to the anchor", () => {
    const next = computeNextRun("every:6h", FIXED);
    expect(next.getTime() - FIXED.getTime()).toBe(6 * 60 * 60 * 1000);
  });

  it("computeNextRun falls back to now() when no anchor passed", () => {
    const before = Date.now();
    const next = computeNextRun("every:5m");
    const after = Date.now();
    const delta = next.getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(delta).toBeLessThanOrEqual(5 * 60 * 1000 + (after - before) + 5);
  });
});

describe("isDue", () => {
  it("returns true when nextRunAt is null (never been run)", () => {
    expect(isDue(null, FIXED)).toBe(true);
  });

  it("returns true when nextRunAt is in the past", () => {
    const past = new Date(FIXED.getTime() - 1000);
    expect(isDue(past, FIXED)).toBe(true);
  });

  it("returns true when nextRunAt is exactly now", () => {
    expect(isDue(FIXED, FIXED)).toBe(true);
  });

  it("returns false when nextRunAt is in the future", () => {
    const future = new Date(FIXED.getTime() + 1000);
    expect(isDue(future, FIXED)).toBe(false);
  });

  it("grace window catches up rows that JUST missed", () => {
    const justAhead = new Date(FIXED.getTime() + 30 * 1000); // 30s away
    expect(isDue(justAhead, FIXED, 60 * 1000)).toBe(true);   // grace 60s -> yes
    expect(isDue(justAhead, FIXED, 0)).toBe(false);           // no grace -> no
  });
});
