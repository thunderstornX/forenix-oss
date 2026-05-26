/**
 * GET /api/demo/try
 *
 * "Try the demo" path for the Vercel concept surface. Lets a public
 * visitor sign into a seeded viewer-role account without a waitlist
 * approval, so they can roam the seeded data and decide whether to
 * apply for the real product at demo.forenix.tech.
 *
 * Gated by DEMO_VISITOR_ENABLED=true. We set this on Vercel only;
 * on the DigitalOcean droplet (the paid SaaS) the env is unset and
 * this route returns 404 so the demo backdoor never opens.
 *
 * The endpoint:
 *   1. Ensures the demo user exists (idempotent upsert).
 *   2. Returns the credentials for the client to feed into
 *      next-auth's signIn(). The credentials are intentionally
 *      public — the whole point is that anyone with a browser can
 *      use them. The user has the lowest-rank role ("viewer") so
 *      any mutating endpoint refuses them.
 *
 * Note on the password: it's a constant, exposed in the JSON
 * response. That's fine. The threat model is "let visitors browse
 * seeded data"; there is no secret to protect.
 */
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";  // never cache

const DEMO_EMAIL = "demo@forenix.example";
const DEMO_NAME = "Demo Visitor";
// Intentionally constant + public. Anyone using the Vercel concept
// surface can sign in as this user.
const DEMO_PASSWORD = "try-the-demo";

// In-process token bucket for the visitor demo endpoint. Public,
// DB-writing, so we don't want a single client to hammer it. Same
// shape as the bucket in /api/waitlist. Single-instance only (good
// enough for Vercel functions which run a small handful of warm
// instances in parallel).
const BUCKETS = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60 * 1000;     // 1 min
const RATE_LIMIT     = 20;            // 20 try-the-demo clicks per IP per minute

function hashIp(req: Request): string {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function rateLimit(ipHash: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cur = BUCKETS.get(ipHash);
  if (!cur || cur.resetAt < now) {
    BUCKETS.set(ipHash, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }
  cur.count += 1;
  if (cur.count > RATE_LIMIT) {
    return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export async function GET(request: Request) {
  if (process.env.DEMO_VISITOR_ENABLED !== "true") {
    return new Response("Not Found", { status: 404 });
  }

  const rl = rateLimit(hashIp(request));
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // Make sure the demo user exists with the expected password hash.
  // Upsert keeps this idempotent across re-deploys and lets us rotate
  // the password by changing DEMO_PASSWORD + redeploying.
  //
  // The update branch deliberately does NOT clear `disabled`, so an
  // admin who manually disables the demo user (e.g. after spotting
  // abuse on Vercel) is respected — the next visitor will see a
  // failed sign-in rather than silently re-enabling the account.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      role: "viewer",
      passwordHash,
    },
    update: {
      // Keep the hash current in case DEMO_PASSWORD changes.
      passwordHash,
      role: "viewer",
    },
    select: { id: true, disabled: true },
  });

  if (user.disabled) {
    return Response.json(
      { error: "demo_disabled", note: "An admin has disabled the demo account on this surface." },
      { status: 503 },
    );
  }

  // Multi-tenant safety. Two cases:
  //
  //  (a) No orgs exist on the deployment → OSS / Vercel concept
  //      mode. Every team's data is seeded demo data, so add the
  //      visitor to every team so the dashboard isn't empty. Same
  //      behaviour as before.
  //  (b) At least one org exists → SaaS-style deployment. Real
  //      tenant data is at risk if the visitor joins existing
  //      teams. Restrict to a dedicated demo-org / demo-team so the
  //      visitor only ever sees data explicitly seeded under it.
  //
  // This closes the Tier A3 "demo visitor scope" gap without
  // breaking the existing Vercel concept surface that currently
  // has zero orgs configured.
  const orgCount = await prisma.organization.count();
  if (orgCount === 0) {
    const teams = await prisma.team.findMany({ select: { id: true } });
    for (const t of teams) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: t.id, userId: user.id } },
        create: { teamId: t.id, userId: user.id, role: "member" },
        update: {},
      });
    }
  } else {
    const demoOrg = await prisma.organization.upsert({
      where: { slug: "demo" },
      create: { name: "Demo Org", slug: "demo" },
      update: {},
      select: { id: true },
    });
    const demoTeam = await prisma.team.upsert({
      where: { slug: "demo" },
      create: { name: "Demo Team", slug: "demo", orgId: demoOrg.id },
      update: { orgId: demoOrg.id },
      select: { id: true },
    });
    // Pin the visitor's primary org so teamScopeWhere() applies the
    // demo-org filter on every read.
    await prisma.user.update({
      where: { id: user.id },
      data: { orgId: demoOrg.id },
    });
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: demoTeam.id, userId: user.id } },
      create: { teamId: demoTeam.id, userId: user.id, role: "member" },
      update: {},
    });
  }

  return Response.json({
    data: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      note: "viewer role — read-only access to seeded data.",
    },
  });
}
