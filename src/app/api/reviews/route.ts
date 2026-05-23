import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

export async function GET() {
  try {
    const actor = await requireSession();
    // MergeRequest hangs off Case; scope through the parent.
    const rows = await prisma.mergeRequest.findMany({
      where: { case: teamScopeWhere(actor) },
      orderBy: { createdAt: "desc" },
      include: {
        case: { select: { id: true, title: true, caseNumber: true } },
        branch: { select: { name: true, color: true } },
        reviewer: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    });
    return Response.json({ data: rows });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
