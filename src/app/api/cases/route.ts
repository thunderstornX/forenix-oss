import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { paginateSlice, readPageParams } from "@/lib/pagination";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

const CreateBody = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(2_000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export async function GET(request: Request) {
  try {
    const actor = await requireSession();
    const page = readPageParams(new URL(request.url));
    const rows = await prisma.case.findMany({
      where: teamScopeWhere(actor),
      orderBy: { updatedAt: "desc" },
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        caseNumber: true,
        status: true,
        priority: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
        teamId: true,
        _count: { select: { evidence: true, branches: true, investigations: true } },
      },
    });
    const { data, nextCursor } = paginateSlice(rows, page.limit);
    return Response.json({ data, nextCursor });
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

    const count = await prisma.case.count();
    const year = new Date().getFullYear();
    const caseNumber = `CASE-${year}-${String(count + 1).padStart(3, "0")}`;

    const teamId = actor.teamIds[0] ?? null;

    const created = await prisma.case.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        caseNumber,
        status: "open",
        teamId,
        branches: {
          create: {
            name: "main",
            isMain: true,
            status: "active",
            color: "#10b981",
          },
        },
      },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        status: true,
        priority: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
        teamId: true,
        _count: { select: { evidence: true, branches: true, investigations: true } },
      },
    });

    await appendAudit({
      action: "create_case",
      entity: "Case",
      entityId: created.id,
      caseId: created.id,
      userId: actor.userId,
      details: { title: created.title, caseNumber: created.caseNumber },
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
