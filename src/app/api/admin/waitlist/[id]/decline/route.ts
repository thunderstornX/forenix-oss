/**
 * POST /api/admin/waitlist/[id]/decline
 *
 * Admin-only. Marks a waitlist row as declined. Idempotent (a
 * second call on an already-declined row is a no-op + returns 200).
 * Does not delete the row — kept for audit + analytics.
 */
import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const { id } = await ctx.params;

    const row = await prisma.waitlistSignup.findUnique({ where: { id } });
    if (!row) {
      return Response.json({ error: "waitlist_row_not_found" }, { status: 404 });
    }
    if (row.status === "invited") {
      return Response.json(
        { error: "already_invited", invitedAt: row.invitedAt },
        { status: 409 },
      );
    }

    await prisma.waitlistSignup.update({
      where: { id },
      data: { status: "declined" },
    });

    await appendAudit({
      action: "waitlist_decline",
      entity: "WaitlistSignup",
      entityId: row.id,
      userId: actor.userId,
      details: { email: row.email },
    });

    return Response.json({ data: { ok: true, status: "declined" } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
