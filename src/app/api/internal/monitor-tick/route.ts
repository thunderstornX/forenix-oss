/**
 * Internal scheduler tick.
 *
 * Posted to by Vercel Cron (in serverless deployments) and by the
 * Droplet's systemd timer (on self-hosted). Same code path, two
 * drivers  -  see src/lib/monitor-scheduler/scheduler.ts for the
 * architectural sketch.
 *
 * Auth: shared-secret in the Authorization header. We don't gate
 * with next-auth here because (1) cron is non-interactive, and (2)
 * Vercel Cron sends a `CRON_SECRET` header convention that maps
 * cleanly onto this same check. Either of the two known secrets is
 * accepted so a deploy from the dashboard works the same as one
 * from the Droplet timer.
 */
import { runMonitorTick } from "@/lib/monitor-scheduler/scheduler";
import { bearerFromHeader, timingSafeStringEqual } from "@/lib/security";

function isAuthorised(req: Request): boolean {
  const expected = process.env.MONITOR_CRON_TOKEN ?? process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  // Accept both "Bearer <token>" and bare "<token>" so the Vercel Cron
  // built-in `CRON_SECRET` (which sends "Bearer ...") and a curl from
  // the Droplet timer can both reach us.
  return timingSafeStringEqual(bearerFromHeader(req), expected);
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "25");
    const result = await runMonitorTick({
      limit: Number.isInteger(limit) && limit > 0 ? limit : 25,
    });
    return Response.json({ data: result });
  } catch (e) {
    return Response.json(
      { error: "tick_failed", details: (e as Error).message },
      { status: 500 },
    );
  }
}

// GET is allowed too so an operator can curl the endpoint from a
// browser-like context for ad-hoc debugging  -  same auth gate.
export const GET = POST;
