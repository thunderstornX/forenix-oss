/**
 * In-process rate limiter.
 *
 * Single-instance only (good enough for the small handful of warm
 * Next functions a typical Vercel deployment or a single-droplet
 * deploy holds at once). For multi-instance, swap the Map for a
 * Redis bucket without changing the call sites.
 *
 * Use it from any route handler:
 *
 *   const rl = checkRateLimit(`pipeline:${actor.userId}`, 10, 60 * 60 * 1000);
 *   if (!rl.ok) {
 *     return Response.json(
 *       { error: "rate_limited", retryAfter: rl.retryAfterSec },
 *       { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
 *     );
 *   }
 *
 * Keys should encode the resource being protected and the actor that
 * counts toward the bucket (a userId for authenticated routes; an
 * SHA-256 of the client IP for public-facing routes; or a tuple of
 * the two).
 *
 * NOTE: deliberately no `import "server-only"` so bun:test can load
 * the file. Production callers (route handlers) are already
 * server-only on their own.
 */

const BUCKETS = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cur = BUCKETS.get(key);
  if (!cur || cur.resetAt < now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  cur.count += 1;
  if (cur.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Reset all buckets. Test-only escape hatch. */
export function _resetRateLimitsForTests(): void {
  BUCKETS.clear();
}
