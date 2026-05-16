import { z } from "zod";
import bcrypt from "bcryptjs";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const CreateBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "investigator", "analyst", "viewer"]).default("investigator"),
  password: z.string().min(6).max(200),
});

export async function GET() {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, email: true, name: true, role: true,
        status: true, disabled: true,
        createdAt: true, updatedAt: true,
        _count: { select: { teamMemberships: true, auditLogs: true } },
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
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    await appendAudit({
      action: "admin_create_user",
      entity: "User",
      entityId: user.id,
      userId: actor.userId,
      details: { email: user.email, role: user.role },
    });
    return Response.json({ data: user }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
