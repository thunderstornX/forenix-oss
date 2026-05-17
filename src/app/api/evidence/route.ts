import { prisma } from "@/lib/db";
import { paginateSlice, readPageParams } from "@/lib/pagination";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const actor = await requireSession();
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const page = readPageParams(url);

    // Scope: if caseId is given we honour that directly; otherwise
    // restrict to evidence whose parent case is in the actor's
    // team scope.
    const where = caseId
      ? { caseId }
      : { case: teamScopeWhere(actor) };

    const rows = await prisma.evidence.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      include: {
        case: { select: { id: true, title: true, caseNumber: true } },
        _count: { select: { commits: true, findings: true, comments: true } },
      },
    });

    // Evidence.size is BigInt  -  coerce to string on the wire.
    const serialized = rows.map((r) => ({ ...r, size: r.size.toString() }));
    const { data, nextCursor } = paginateSlice(serialized, page.limit);
    return Response.json({ data, nextCursor });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
