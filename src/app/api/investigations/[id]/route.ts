import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.investigation.findUnique({
    where: { id },
    include: {
      case: {
        select: { id: true, title: true, caseNumber: true, status: true },
      },
      findings: {
        orderBy: { createdAt: "desc" },
        include: {
          evidence: { select: { id: true, name: true, hash: true } },
          _count: { select: { annotations: true } },
        },
      },
      monitors: {
        orderBy: { createdAt: "desc" },
        include: {
          runs: { orderBy: { startedAt: "desc" }, take: 3 },
        },
      },
      reports: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, title: true, status: true, type: true,
          findingCount: true, updatedAt: true, source: true,
        },
      },
      schedules: true,
      entities: {
        include: {
          fromEntity: true,
          toEntity: true,
        },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, action: true, entity: true, entityId: true,
          hash: true, prevHash: true, createdAt: true,
        },
      },
      _count: {
        select: {
          findings: true, monitors: true, reports: true,
          entities: true, auditLogs: true, schedules: true,
        },
      },
    },
  });
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ data: row });
}
