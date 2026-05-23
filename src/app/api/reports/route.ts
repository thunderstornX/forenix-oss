import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

export async function GET() {
  try {
    const actor = await requireSession();
    const scope = teamScopeWhere(actor);
    // A Report is in scope if EITHER parent (case or investigation) is.
    const rows = await prisma.report.findMany({
      where: {
        OR: [
          { case: scope },
          { investigation: scope },
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        investigation: { select: { id: true, title: true, target: true } },
        case: { select: { id: true, title: true, caseNumber: true } },
        generator: { select: { id: true, name: true } },
      },
    });
    return Response.json({ data: rows });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
