import { prisma } from "@/lib/db";
import {
  httpErrorResponse,
  requireReportInScope,
  requireSession,
} from "@/lib/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    await requireReportInScope(actor, id);

    const row = await prisma.report.findUnique({
      where: { id },
      include: {
        investigation: { select: { id: true, title: true, target: true, targetType: true, objective: true } },
        case: { select: { id: true, title: true, caseNumber: true } },
        generator: { select: { id: true, name: true } },
      },
    });
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ data: row });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
