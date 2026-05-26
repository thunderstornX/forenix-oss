/**
 * /api/monitors/[id]
 *
 * PATCH  - toggle pause / resume, change cadence, change target.
 *          investigator+ role. Pausing nulls nextRunAt so the
 *          scheduler stops considering it; resuming sets it to
 *          (lastRunAt + cadence) so the row resumes at the same
 *          pace it left off at.
 * DELETE - tombstone the row. Audit-logged.
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { computeNextRun, parseCadence } from "@/lib/monitor-scheduler/cadence";
import {
  HttpError,
  httpErrorResponse,
  requireRole,
  requireSession,
  teamScopeWhere,
} from "@/lib/rbac";
import type { ActorContext } from "@/lib/rbac";

/** Monitor inherits scope via its parent Investigation. Returns the
 *  full Monitor row or throws 404. */
async function requireMonitorInScope(actor: ActorContext, id: string) {
  const m = await prisma.monitor.findFirst({
    where: { id, investigation: teamScopeWhere(actor) },
  });
  if (!m) throw new HttpError(404, "monitor_not_found");
  return m;
}

const PatchBody = z.object({
  status: z.enum(["active", "paused"]).optional(),
  cadence: z.string().min(1).max(40).optional(),
  target: z.string().min(1).max(500).optional(),
  targetType: z.string().min(1).max(40).optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "investigator");
    const { id } = await ctx.params;
    const body = PatchBody.parse(await request.json());

    const cur = await requireMonitorInScope(actor, id);

    let nextCadence = cur.cadence;
    if (body.cadence) {
      try {
        nextCadence = parseCadence(body.cadence).canonical;
      } catch (e) {
        return Response.json(
          { error: "invalid_cadence", details: (e as Error).message },
          { status: 400 },
        );
      }
    }

    // Resume rules: if going active and we don't yet have a nextRunAt,
    // anchor on the last run; if there was no last run, fire shortly.
    let nextRunAt = cur.nextRunAt;
    if (body.status === "paused") {
      nextRunAt = null;
    } else if (body.status === "active" || body.cadence) {
      const anchor = cur.lastRunAt ?? new Date();
      nextRunAt = computeNextRun(nextCadence, anchor);
      // If the recomputed next run is already in the past (cadence
      // change made it overdue), schedule it for ~30s out instead.
      if (nextRunAt.getTime() < Date.now()) {
        nextRunAt = new Date(Date.now() + 30 * 1000);
      }
    }

    const updated = await prisma.monitor.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.cadence ? { cadence: nextCadence } : {}),
        ...(body.target ? { target: body.target } : {}),
        ...(body.targetType ? { targetType: body.targetType } : {}),
        nextRunAt,
      },
      include: {
        investigation: { select: { id: true, title: true, target: true } },
        runs: { orderBy: { startedAt: "desc" }, take: 3 },
        _count: { select: { runs: true } },
      },
    });

    await appendAudit({
      action: body.status === "paused"
        ? "monitor_paused"
        : body.status === "active"
        ? "monitor_resumed"
        : "monitor_updated",
      entity: "Monitor",
      entityId: id,
      userId: actor.userId,
      investigationId: updated.investigationId ?? null,
      details: { changes: body },
    });

    return Response.json({ data: updated });
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

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "investigator");
    const { id } = await ctx.params;

    const row = await requireMonitorInScope(actor, id);

    await prisma.monitor.delete({ where: { id } });
    await appendAudit({
      action: "monitor_deleted",
      entity: "Monitor",
      entityId: id,
      userId: actor.userId,
      investigationId: row.investigationId ?? null,
      details: { target: row.target },
    });

    return Response.json({ data: { ok: true } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
