/**
 * GET /api/admin/waitlist — admin-only triage list for the public
 * waitlist sign-ups. Pure read; the invite flow stays manual for
 * now (admins copy the email out and send their own message).
 */
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const rows = await prisma.waitlistSignup.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        email: true,
        role: true,
        useCase: true,
        source: true,
        status: true,
        createdAt: true,
        invitedAt: true,
      },
    });
    return Response.json({ data: rows, total: rows.length });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
