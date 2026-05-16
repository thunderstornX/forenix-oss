import { createHash } from "node:crypto";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ev = await prisma.evidence.findUnique({ where: { id } });
  if (!ev) return Response.json({ error: "not_found" }, { status: 404 });
  if (ev.status === "sealed") {
    return Response.json({ error: "already_sealed" }, { status: 409 });
  }
  const updated = await prisma.evidence.update({
    where: { id },
    data: { status: "sealed" },
  });
  // Add a "seal" commit on the case's main branch.
  const main = await prisma.branch.findFirst({ where: { caseId: ev.caseId, isMain: true } });
  if (main) {
    await prisma.evidenceCommit.create({
      data: {
        evidenceId: id,
        branchId: main.id,
        commitHash: createHash("sha256").update(`commit:${id}:seal:${Date.now()}`).digest("hex"),
        message: `seal: evidence locked, no further mutations`,
        authorId: "current_user",
        changeType: "seal",
        verified: true,
        verifiedBy: "current_user",
        verifiedAt: new Date(),
      },
    });
  }
  await appendAudit({
    action: "seal_evidence",
    entity: "Evidence",
    entityId: id,
    caseId: ev.caseId,
    details: { hash: ev.hash },
  });
  return Response.json({ data: updated });
}
