/**
 * Tests for src/lib/rate-limit.ts.
 */
import { describe, it, expect, beforeEach } from "bun:test";

import { checkRateLimit, _resetRateLimitsForTests } from "./rate-limit";

beforeEach(() => {
  _resetRateLimitsForTests();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit and blocks at the threshold", () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit("k", 3, 60_000);
      expect(r.ok).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("separate keys have separate buckets", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("a", 3, 60_000);
    const aBlocked = checkRateLimit("a", 3, 60_000);
    const bAllowed = checkRateLimit("b", 3, 60_000);
    expect(aBlocked.ok).toBe(false);
    expect(bAllowed.ok).toBe(true);
  });

  it("retryAfterSec is non-negative and bounded by the window", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("k", 1, 30_000);
    const r = checkRateLimit("k", 1, 30_000);
    expect(r.retryAfterSec).toBeGreaterThanOrEqual(0);
    expect(r.retryAfterSec).toBeLessThanOrEqual(30);
  });
});
