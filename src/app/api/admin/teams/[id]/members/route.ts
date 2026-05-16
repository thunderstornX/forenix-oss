import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const CreateBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

const DeleteBody = z.object({
  userId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const { id } = await params;
    const body = CreateBody.parse(await request.json());
    const membership = await prisma.teamMember.create({
      data: { teamId: id, userId: body.userId, role: body.role },
    });
    await appendAudit({
      action: "admin_add_team_member",
      entity: "TeamMember",
      entityId: membership.id,
      userId: actor.userId,
      details: { teamId: id, memberUserId: body.userId, role: body.role },
    });
    return Response.json({ data: membership }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const { id } = await params;
    const body = DeleteBody.parse(await request.json());
    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId: id, userId: body.userId } },
    });
    await appendAudit({
      action: "admin_remove_team_member",
      entity: "TeamMember",
      entityId: `${id}/${body.userId}`,
      userId: actor.userId,
      details: { teamId: id, memberUserId: body.userId },
    });
    return Response.json({ data: { ok: true } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
