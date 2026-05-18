/**
 * /api/admin/attestation-schedule/[id]
 *
 * PATCH  - toggle enabled, change cadence, change backend.
 * DELETE - tombstone the schedule.
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { listAttestationBackends } from "@/lib/attestation/factory";
import { computeNextRun, parseCadence } from "@/lib/monitor-scheduler/cadence";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const PatchBody = z.object({
  enabled: z.boolean().optional(),
  cadence: z.string().min(1).max(40).optional(),
  backend: z.string().min(1).max(32).optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const { id } = await ctx.params;
    const body = PatchBody.parse(await request.json());

    const cur = await prisma.attestationSchedule.findUnique({ where: { id } });
    if (!cur) {
      return Response.json({ error: "schedule_not_found" }, { status: 404 });
    }

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
    if (body.backend) {
      const backends = listAttestationBackends().map((b) => b.name);
      if (!backends.includes(body.backend)) {
        return Response.json(
          { error: "unknown_backend", details: `available: ${backends.join(", ")}` },
          { status: 400 },
        );
      }
    }

    let nextRunAt = cur.nextRunAt;
    if (body.enabled === false) {
      nextRunAt = null;
    } else if (body.enabled === true || body.cadence) {
      const anchor = cur.lastRunAt ?? new Date();
      const candidate = computeNextRun(nextCadence, anchor);
      nextRunAt = candidate.getTime() < Date.now()
        ? new Date(Date.now() + 30 * 1000)
        : candidate;
    }

    const updated = await prisma.attestationSchedule.update({
      where: { id },
      data: {
        ...(body.backend ? { backend: body.backend } : {}),
        ...(body.cadence ? { cadence: nextCadence } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        nextRunAt,
      },
    });

    await appendAudit({
      action: body.enabled === false
        ? "attestation_schedule_paused"
        : body.enabled === true
        ? "attestation_schedule_resumed"
        : "attestation_schedule_updated",
      entity: "AttestationSchedule",
      entityId: id,
      userId: actor.userId,
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
    requireRole(actor, "admin");
    const { id } = await ctx.params;

    const cur = await prisma.attestationSchedule.findUnique({ where: { id } });
    if (!cur) {
      return Response.json({ error: "schedule_not_found" }, { status: 404 });
    }
    await prisma.attestationSchedule.delete({ where: { id } });
    await appendAudit({
      action: "attestation_schedule_deleted",
      entity: "AttestationSchedule",
      entityId: id,
      userId: actor.userId,
      details: { backend: cur.backend, cadence: cur.cadence },
    });
    return Response.json({ data: { ok: true } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
