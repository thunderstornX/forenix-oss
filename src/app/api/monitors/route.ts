/**
 * /api/monitors
 *
 * GET   - list all monitors (any signed-in user).
 * POST  - create a new monitor (investigator+). Body validates the
 *         cadence string up-front so the scheduler never has to
 *         deal with garbage cadence values at tick time.
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseCadence } from "@/lib/monitor-scheduler/cadence";
import {
  httpErrorResponse,
  requireInvestigationInScope,
  requireRole,
  requireSession,
  teamScopeWhere,
} from "@/lib/rbac";

const Body = z.object({
  investigationId: z.string().min(1).optional(),
  target: z.string().min(1).max(500),
  targetType: z.string().min(1).max(40),
  cadence: z.string().min(1).max(40).default("weekly"),
  alertConfig: z.string().default("{}"),
  status: z.enum(["active", "paused"]).default("active"),
});

export async function GET() {
  try {
    const actor = await requireSession();
    const scope = teamScopeWhere(actor);
    const rows = await prisma.monitor.findMany({
      // Monitor scope inherits via parent Investigation. Orphan monitors
      // (investigationId null) only surface to the operator.
      where: { investigation: scope },
      orderBy: { updatedAt: "desc" },
      include: {
        investigation: { select: { id: true, title: true, target: true } },
        runs: { orderBy: { startedAt: "desc" }, take: 3 },
        _count: { select: { runs: true } },
      },
    });
    return Response.json({ data: rows });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession();
    requireRole(actor, "investigator");
    const body = Body.parse(await request.json());

    // If the body pins an investigationId, that investigation must be
    // in the actor's tenant scope. Without this guard, an investigator
    // in Team A could schedule a monitor against Team B's investigation.
    if (body.investigationId) {
      await requireInvestigationInScope(actor, body.investigationId);
    }

    // Validate the cadence up-front  -  the scheduler refuses to
    // create a row it can't compute a nextRunAt for.
    let parsed;
    try {
      parsed = parseCadence(body.cadence);
    } catch (e) {
      return Response.json(
        { error: "invalid_cadence", details: (e as Error).message },
        { status: 400 },
      );
    }

    const row = await prisma.monitor.create({
      data: {
        investigationId: body.investigationId ?? null,
        target: body.target,
        targetType: body.targetType,
        cadence: parsed.canonical,
        alertConfig: body.alertConfig,
        status: body.status,
        // First tick fires (almost) immediately so the operator sees
        // a result without waiting a full cadence.
        nextRunAt: body.status === "active" ? new Date(Date.now() + 30 * 1000) : null,
      },
      include: {
        investigation: { select: { id: true, title: true, target: true } },
        runs: true,
        _count: { select: { runs: true } },
      },
    });

    await appendAudit({
      action: "monitor_created",
      entity: "Monitor",
      entityId: row.id,
      userId: actor.userId,
      investigationId: row.investigationId ?? null,
      details: { target: row.target, cadence: row.cadence },
    });

    return Response.json({ data: row });
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
