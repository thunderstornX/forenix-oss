import { randomBytes } from "node:crypto";
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const CreateBody = z.object({
  teamId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
  ttlHours: z.number().int().min(1).max(24 * 30).default(72),
});

function token(): string {
  return randomBytes(24).toString("base64url");
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const body = CreateBody.parse(await request.json());
    const invite = await prisma.teamInvite.create({
      data: {
        teamId:    body.teamId,
        email:     body.email,
        role:      body.role,
        token:     token(),
        sentById:  actor.userId,
        expiresAt: new Date(Date.now() + body.ttlHours * 3600 * 1000),
      },
    });
    await appendAudit({
      action: "admin_invite_user",
      entity: "TeamInvite",
      entityId: invite.id,
      userId: actor.userId,
      details: { teamId: body.teamId, email: body.email, role: body.role },
    });
    // Token is the *only* time we return the secret. Email-less in 0.1
    // — caller copies the link and forwards it manually.
    return Response.json({ data: { ...invite } }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function GET() {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const rows = await prisma.teamInvite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        team:   { select: { name: true, slug: true } },
        sentBy: { select: { name: true, email: true } },
      },
    });
    return Response.json({ data: rows });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
