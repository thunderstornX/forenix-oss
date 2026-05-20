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

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";  // never cache

const DEMO_EMAIL = "demo@forenix.example";
const DEMO_NAME = "Demo Visitor";
// Intentionally constant + public. Anyone using the Vercel concept
// surface can sign in as this user.
const DEMO_PASSWORD = "try-the-demo";

export async function GET() {
  if (process.env.DEMO_VISITOR_ENABLED !== "true") {
    return new Response("Not Found", { status: 404 });
  }

  // Make sure the demo user exists with the expected password hash.
  // Upsert keeps this idempotent across re-deploys and lets us rotate
  // the password by changing DEMO_PASSWORD + redeploying.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.upsert({
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
      disabled: false,
    },
  });

  return Response.json({
    data: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      note: "viewer role — read-only access to seeded data.",
    },
  });
}
