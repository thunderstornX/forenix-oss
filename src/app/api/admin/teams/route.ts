import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const CreateBody = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const rows = await prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { members: true, cases: true, investigations: true } },
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
    requireRole(actor, "admin");
    const body = CreateBody.parse(await request.json());
    const team = await prisma.team.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        members: { create: { userId: actor.userId, role: "owner" } },
      },
    });
    await appendAudit({
      action: "admin_create_team",
      entity: "Team",
      entityId: team.id,
      userId: actor.userId,
      details: { slug: team.slug },
    });
    return Response.json({ data: team }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
