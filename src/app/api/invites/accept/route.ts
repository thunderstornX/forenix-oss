import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

const Body = z.object({ token: z.string().min(8) });

export async function POST(request: Request) {
  try {
    const actor = await requireSession();
    const { token } = Body.parse(await request.json());

    const invite = await prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) return Response.json({ error: "invalid_token" }, { status: 404 });
    if (invite.acceptedAt) return Response.json({ error: "already_accepted" }, { status: 409 });
    if (invite.expiresAt < new Date()) return Response.json({ error: "expired" }, { status: 410 });

    // Mark accepted + create membership (skip if already a member).
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: actor.userId } },
    });
    if (!existing) {
      await prisma.teamMember.create({
        data: { teamId: invite.teamId, userId: actor.userId, role: invite.role },
      });
    }
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    await appendAudit({
      action: "accept_team_invite",
      entity: "TeamMember",
      entityId: `${invite.teamId}/${actor.userId}`,
      userId: actor.userId,
      details: { teamId: invite.teamId, role: invite.role },
    });
    return Response.json({ data: { teamId: invite.teamId, role: invite.role } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
