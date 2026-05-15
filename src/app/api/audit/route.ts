import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1_000);
  const investigationId = url.searchParams.get("investigationId");
  const caseId = url.searchParams.get("caseId");

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(investigationId ? { investigationId } : {}),
      ...(caseId ? { caseId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
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
  return Response.json({ data: rows, total: rows.length });
}
