import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  httpErrorResponse,
  requireFindingInScope,
  requireSession,
} from "@/lib/rbac";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    const f = await requireFindingInScope(actor, id);

    const updated = await prisma.finding.update({
      where: { id },
      data: {
        verified: true,
        verifiedBy: actor.name ?? actor.email ?? actor.userId,
        confidence: f.confidence === "unverified" ? "confirmed" : f.confidence,
      },
    });
    await appendAudit({
      action: "verify_finding",
      entity: "Finding",
      entityId: id,
      userId: actor.userId,
      investigationId: f.investigationId,
      details: { title: f.title },
    });
    return Response.json({ data: updated });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
