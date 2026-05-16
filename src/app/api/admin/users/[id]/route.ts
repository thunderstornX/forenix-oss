import { z } from "zod";
import bcrypt from "bcryptjs";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

const PatchBody = z.object({
  role: z.enum(["admin", "investigator", "analyst", "viewer"]).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(6).max(200).optional(),
  name: z.string().min(1).max(120).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const { id } = await params;
    const body = PatchBody.parse(await request.json());

    const data: Record<string, unknown> = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.disabled !== undefined) data.disabled = body.disabled;
    if (body.name !== undefined) data.name = body.name;
    if (body.password !== undefined) data.passwordHash = await bcrypt.hash(body.password, 10);

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, disabled: true },
    });

    await appendAudit({
      action: "admin_update_user",
      entity: "User",
      entityId: id,
      userId: actor.userId,
      details: { changed: Object.keys(body) },
    });

    return Response.json({ data: updated });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
