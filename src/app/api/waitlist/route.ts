/**
 * POST /api/waitlist  -  public sign-up endpoint for the marketing
 * landing page. Idempotent on email (upsert), rate-limited per IP
 * with an in-memory bucket (good enough for a single-instance OSS
 * deploy; if you scale this, swap for Upstash Redis).
 *
 * Doesn't require auth and doesn't return a session  -  it's a
 * forms-of-interest collector, nothing more.
 */
import { createHash } from "node:crypto";

import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse } from "@/lib/rbac";

const Body = z.object({
  email: z.string().email().max(254),
  role: z.enum(["analyst", "investigator", "ciso", "researcher", "other"]).optional(),
  useCase: z.string().trim().max(500).optional(),
  source: z.string().trim().max(120).optional(),
});

// Simple per-IP token bucket. Allows up to 5 submissions per 10 min.
// In-process, lost on restart  -  which is fine for the threat model
// (spam mitigation, not auth). Production scale switches to Redis.
const BUCKETS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

function rateLimit(ipHash: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cur = BUCKETS.get(ipHash);
  if (!cur || cur.resetAt < now) {
    BUCKETS.set(ipHash, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }
  cur.count += 1;
  if (cur.count > LIMIT) {
    return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

function hashIp(req: Request): string {
  // Trust the standard proxy headers Caddy / Vercel set. Fall back
  // to "unknown" so requests without a forwarded IP still bucket
  // somewhere (worst case: all anon traffic shares one bucket).
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  try {
    const ipHash = hashIp(request);
    const rl = rateLimit(ipHash);
    if (!rl.ok) {
      return Response.json(
        { error: "rate_limited", retryAfter: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
    const body = Body.parse(await request.json());

    const row = await prisma.waitlistSignup.upsert({
      where: { email: body.email.toLowerCase() },
      create: {
        email: body.email.toLowerCase(),
        role: body.role ?? null,
        useCase: body.useCase ?? null,
        source: body.source ?? null,
        ipHash,
      },
      update: {
        // Idempotent: re-submission updates the optional fields but
        // never bumps createdAt so we don't reward spam with a fresh
        // queue position.
        role: body.role ?? undefined,
        useCase: body.useCase ?? undefined,
        source: body.source ?? undefined,
      },
    });

    await appendAudit({
      action: "waitlist_signup",
      entity: "WaitlistSignup",
      entityId: row.id,
      details: { role: row.role ?? null, source: row.source ?? null },
    });

    return Response.json({ data: { ok: true, position: await positionOf(row.id) } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_body", details: err.issues },
        { status: 400 },
      );
    }
    return httpErrorResponse(err);
  }
}

async function positionOf(id: string): Promise<number> {
  const row = await prisma.waitlistSignup.findUnique({
    where: { id },
    select: { createdAt: true },
  });
  if (!row) return 0;
  return prisma.waitlistSignup.count({
    where: { createdAt: { lte: row.createdAt } },
  });
}
