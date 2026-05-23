import { prisma } from "@/lib/db";
import { httpErrorResponse, requireCaseInScope, requireSession } from "@/lib/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    // Scope check first: returns 404 if the actor cannot see this case,
    // so we never disclose the row's existence to other tenants.
    await requireCaseInScope(actor, id);

    const row = await prisma.case.findUnique({
      where: { id },
      include: {
        evidence: {
          orderBy: { createdAt: "desc" },
          include: {
            commits: {
              orderBy: { createdAt: "asc" },
              include: { branch: { select: { name: true, color: true } } },
            },
            _count: { select: { commits: true, findings: true, comments: true } },
          },
        },
        branches: {
          orderBy: { createdAt: "asc" },
          include: { _count: { select: { commits: true, merges: true } } },
        },
        mergeRequests: {
          orderBy: { createdAt: "desc" },
          include: {
            branch: { select: { name: true, color: true } },
            reviewer: { select: { id: true, name: true } },
          },
        },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
        agents: {
          include: { agent: { select: { id: true, name: true, type: true, status: true } } },
        },
        investigations: {
          select: {
            id: true, title: true, target: true, targetType: true,
            status: true, priority: true,
          },
        },
        reports: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, title: true, status: true, type: true,
            source: true, updatedAt: true,
          },
        },
        metrics: { orderBy: { recordedAt: "desc" }, take: 10 },
        auditLogs: { orderBy: { createdAt: "asc" }, take: 50 },
        _count: {
          select: {
            evidence: true, branches: true, mergeRequests: true,
            assignments: true, agents: true, investigations: true,
            reports: true, auditLogs: true,
          },
        },
      },
    });
    if (!row) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    // Prisma returns BigInt for Evidence.size  -  JSON.stringify can't handle it.
    // Cast to string for safe wire transport.
    const serialized = JSON.parse(
      JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    );
    return Response.json({ data: serialized });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
