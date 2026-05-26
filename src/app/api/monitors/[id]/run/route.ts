/**
 * POST /api/monitors/[id]/run
 *
 * "Run now" - bypass the cron tick and execute a single monitor
 * immediately. Useful for operator-initiated checks ("did the
 * scheduled change land?") and for smoke-testing newly created
 * monitors without waiting up to 5 min for the next Vercel Cron
 * tick.
 *
 * Sets nextRunAt to now() under the hood, then invokes
 * runMonitorTick with a tight limit so only this row fires.
 */
import { prisma } from "@/lib/db";
import { runMonitorTick } from "@/lib/monitor-scheduler/scheduler";
import {
  HttpError,
  httpErrorResponse,
  requireRole,
  requireSession,
  teamScopeWhere,
} from "@/lib/rbac";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "investigator");
    const { id } = await ctx.params;

    // Scope-checked lookup: 404 if the monitor's parent investigation
    // is not in the actor's team/org.
    const cur = await prisma.monitor.findFirst({
      where: { id, investigation: teamScopeWhere(actor) },
    });
    if (!cur) throw new HttpError(404, "monitor_not_found");

    // Push the row to the head of the queue and let the standard
    // scheduler pick it up  -  keeps a single code path for "what it
    // means to run a monitor."
    await prisma.monitor.update({
      where: { id },
      data: { nextRunAt: new Date(), status: "active" },
    });

    const result = await runMonitorTick({ limit: 1 });
    const mine = result.perMonitor.find((p) => p.monitorId === id);
    return Response.json({ data: { tick: result, mine } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
