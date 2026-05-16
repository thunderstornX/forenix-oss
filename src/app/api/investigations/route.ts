import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

const CreateBody = z.object({
  title: z.string().min(3).max(200),
  target: z.string().min(1).max(500),
  targetType: z.enum(["domain", "person", "organization", "ip", "username", "phone", "image", "compound"]),
  objective: z.string().min(1).max(2_000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export async function GET() {
  try {
    const actor = await requireSession();
    const rows = await prisma.investigation.findMany({
      where: teamScopeWhere(actor),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        target: true,
        targetType: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        caseId: true,
        teamId: true,
        _count: { select: { findings: true, monitors: true, reports: true } },
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
    let parsed;
    try {
      parsed = CreateBody.parse(await request.json());
    } catch (err) {
      return Response.json(
        { error: "invalid_body", details: (err as Error).message },
        { status: 400 },
      );
    }

    // Default the new investigation to the actor's first team (if any).
    const teamId = actor.teamIds[0] ?? null;

    const created = await prisma.investigation.create({
      data: {
        title:        parsed.title,
        target:       parsed.target,
        targetType:   parsed.targetType,
        objective:    parsed.objective,
        priority:     parsed.priority,
        status:       "draft",
        createdBy:    actor.name ?? actor.email ?? "user",
        teamId,
      },
      select: {
        id: true,
        title: true,
        target: true,
        targetType: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        caseId: true,
        teamId: true,
        _count: { select: { findings: true, monitors: true, reports: true } },
      },
    });

    await appendAudit({
      action: "create_investigation",
      entity: "Investigation",
      entityId: created.id,
      investigationId: created.id,
      userId: actor.userId,
      details: { title: created.title, target: created.target },
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
