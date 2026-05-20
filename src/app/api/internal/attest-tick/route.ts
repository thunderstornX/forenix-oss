/**
 * Cron-triggered attestation tick.
 *
 * Same auth model as /api/internal/monitor-tick - accepts either
 * MONITOR_CRON_TOKEN or Vercel's built-in CRON_SECRET. The two
 * scheduled flows share a token because they share a driver
 * (whichever cron is configured fires both endpoints).
 */
import { runAttestTick } from "@/lib/attestation/scheduler";
import { bearerFromHeader, timingSafeStringEqual } from "@/lib/security";

function isAuthorised(req: Request): boolean {
  const expected = process.env.MONITOR_CRON_TOKEN ?? process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  return timingSafeStringEqual(bearerFromHeader(req), expected);
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const result = await runAttestTick({
      limit: Number.isInteger(limit) && limit > 0 ? limit : 10,
    });
    return Response.json({ data: result });
  } catch (e) {
    return Response.json(
      { error: "tick_failed", details: (e as Error).message },
      { status: 500 },
    );
  }
}

export const GET = POST;
