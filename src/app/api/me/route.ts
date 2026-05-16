import { httpErrorResponse, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const actor = await requireSession();
    const teams = await prisma.teamMember.findMany({
      where: { userId: actor.userId },
      include: { team: { select: { id: true, name: true, slug: true } } },
    });
    return Response.json({
      data: {
        id: actor.userId,
        email: actor.email,
        name: actor.name,
        role: actor.role,
        teams: teams.map((m) => ({
          id: m.team.id,
          name: m.team.name,
          slug: m.team.slug,
          role: m.role,
        })),
      },
    });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
