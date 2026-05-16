import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const f = await prisma.finding.findUnique({ where: { id } });
  if (!f) return Response.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.finding.update({
    where: { id },
    data: { verified: true, verifiedBy: "current_user", confidence: f.confidence === "unverified" ? "confirmed" : f.confidence },
  });
  await appendAudit({
    action: "verify_finding",
    entity: "Finding",
    entityId: id,
    investigationId: f.investigationId,
    details: { title: f.title },
  });
  return Response.json({ data: updated });
}
