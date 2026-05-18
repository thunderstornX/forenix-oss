/**
 * /api/admin/attestation-schedule
 *
 * GET  - list all schedules (admin).
 * POST - create one for a given backend + cadence (admin only).
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { listAttestationBackends } from "@/lib/attestation/factory";
import { parseCadence } from "@/lib/monitor-scheduler/cadence";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const Body = z.object({
  backend: z.string().min(1).max(32),
  cadence: z.string().min(1).max(40).default("daily"),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const rows = await prisma.attestationSchedule.findMany({
      orderBy: { createdAt: "desc" },
    });
    const backends = listAttestationBackends().map((b) => ({
      name: b.name,
      description: b.description,
    }));
    return Response.json({ data: rows, backends });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const body = Body.parse(await request.json());

    // Validate the cadence + the backend up-front.
    let parsed;
    try {
      parsed = parseCadence(body.cadence);
    } catch (e) {
      return Response.json(
        { error: "invalid_cadence", details: (e as Error).message },
        { status: 400 },
      );
    }
    const backends = listAttestationBackends().map((b) => b.name);
    if (!backends.includes(body.backend)) {
      return Response.json(
        { error: "unknown_backend", details: `available: ${backends.join(", ")}` },
        { status: 400 },
      );
    }

    const row = await prisma.attestationSchedule.create({
      data: {
        backend: body.backend,
        cadence: parsed.canonical,
        enabled: body.enabled,
        nextRunAt: body.enabled ? new Date(Date.now() + 30 * 1000) : null,
        createdBy: actor.userId,
      },
    });

    await appendAudit({
      action: "attestation_schedule_created",
      entity: "AttestationSchedule",
      entityId: row.id,
      userId: actor.userId,
      details: { backend: row.backend, cadence: row.cadence },
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
