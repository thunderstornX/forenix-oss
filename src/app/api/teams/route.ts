import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export async function GET() {
  try {
    const actor = await requireSession();
    const rows = await prisma.teamMember.findMany({
      where: { userId: actor.userId },
      include: {
        team: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } },
              orderBy: { joinedAt: "asc" },
            },
            _count: { select: { cases: true, investigations: true } },
          },
        },
      },
    });
    return Response.json({ data: rows.map((m) => ({ membershipRole: m.role, ...m.team })) });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
