import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const CreateBody = z.object({
  title: z.string().min(3).max(200),
  target: z.string().min(1).max(500),
  targetType: z.enum(["domain", "person", "organization", "ip", "username", "phone", "image", "compound"]),
  objective: z.string().min(1).max(2_000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export async function GET() {
  const rows = await prisma.investigation.findMany({
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
      _count: { select: { findings: true, monitors: true, reports: true } },
    },
  });
  return Response.json({ data: rows });
}

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = CreateBody.parse(await request.json());
  } catch (err) {
    return Response.json(
      { error: "invalid_body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const created = await prisma.investigation.create({
    data: {
      title:        parsed.title,
      target:       parsed.target,
      targetType:   parsed.targetType,
      objective:    parsed.objective,
      priority:     parsed.priority,
      status:       "draft",
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
      _count: { select: { findings: true, monitors: true, reports: true } },
    },
  });

  await appendAudit({
    action: "create_investigation",
    entity: "Investigation",
    entityId: created.id,
    investigationId: created.id,
    details: { title: created.title, target: created.target },
  });

  return Response.json({ data: created }, { status: 201 });
}
