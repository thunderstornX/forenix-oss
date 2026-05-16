import { prisma } from "@/lib/db";
import { paginateSlice, readPageParams } from "@/lib/pagination";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const page = readPageParams(url, { defaultLimit: 200, max: 1000 });
    const investigationId = url.searchParams.get("investigationId");
    const caseId = url.searchParams.get("caseId");

    const rows = await prisma.auditLog.findMany({
      where: {
        ...(investigationId ? { investigationId } : {}),
        ...(caseId ? { caseId } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        userId: true,
        caseId: true,
        investigationId: true,
        hash: true,
        prevHash: true,
        details: true,
        createdAt: true,
      },
    });
    const { data, nextCursor } = paginateSlice(rows, page.limit);
    return Response.json({ data, nextCursor, total: data.length });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
