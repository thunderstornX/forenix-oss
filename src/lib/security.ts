/**
 * Shared security helpers used by token-gated routes.
 *
 * The two surfaces here are deliberately small:
 *
 *   - timingSafeStringEqual: constant-time comparison so a token
 *     check can't be probed character-by-character via response-
 *     time deltas. Required for any secret comparison
 *     (CRON_SECRET, MONITOR_CRON_TOKEN, SEED_TOKEN,
 *     WAITLIST_SYNC_TOKEN, etc.).
 *
 *   - bearerFromHeader: pulls the credential out of an
 *     `Authorization: Bearer <token>` header, also tolerating a
 *     bare `<token>` (for the curl-from-cron path) so callers don't
 *     need to negotiate header format.
 *
 * NOTE: deliberately no `import "server-only"` so bun:test can load
 * the file. Every importer in production is a server-only API
 * route; the node:crypto dep below would crash a client bundle
 * anyway if anything slipped past review.
 */

import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Returns false fast if either
 * input is empty (no point timing an empty check). Returns false
 * for different lengths without revealing the length comparison
 * itself — both sides are padded to the same byte length before
 * timingSafeEqual is called, then the length match is folded in.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Compare against a fixed-length buffer so timingSafeEqual doesn't
  // throw on length mismatch and doesn't leak length via the throw.
  const len = Math.max(ab.length, bb.length);
  const aPadded = Buffer.alloc(len);
  const bPadded = Buffer.alloc(len);
  ab.copy(aPadded);
  bb.copy(bPadded);
  return timingSafeEqual(aPadded, bPadded) && ab.length === bb.length;
}

/** Strip an optional "Bearer " prefix from an Authorization header. */
export function bearerFromHeader(req: Request): string {
  const got = req.headers.get("authorization") ?? "";
  return got.replace(/^Bearer\s+/i, "").trim();
}
