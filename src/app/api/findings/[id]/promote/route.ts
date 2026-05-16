/**
 * POST /api/findings/[id]/promote
 *
 * Promote a single OSINT finding to a forensic evidence item.
 * If the parent investigation isn't linked to a case yet, this fails
 * with 409 — caller should bridge first.
 */
import { createHash } from "node:crypto";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const finding = await prisma.finding.findUnique({
    where: { id },
    include: { investigation: { select: { id: true, caseId: true, title: true } } },
  });
  if (!finding) return Response.json({ error: "not_found" }, { status: 404 });
  if (finding.evidenceId) {
    return Response.json({ error: "already_promoted", evidenceId: finding.evidenceId }, { status: 409 });
  }
  const caseId = finding.investigation.caseId;
  if (!caseId) {
    return Response.json(
      { error: "no_case_linked", details: "Bridge the investigation to a case first." },
      { status: 409 },
    );
  }
  const main = await prisma.branch.findFirst({
    where: { caseId, isMain: true },
  });
  if (!main) {
    return Response.json({ error: "no_main_branch" }, { status: 500 });
  }

  const hash = createHash("sha256")
    .update(`finding:${finding.id}:${finding.title}:${finding.description}`)
    .digest("hex");

  const evidence = await prisma.evidence.create({
    data: {
      caseId,
      name: `Finding ${finding.id.slice(0, 8)} — ${finding.title}`,
      type: "document",
      mimeType: "application/x-osint-finding",
      description: finding.description,
      tags: `osint,${finding.agentGroup}`,
      hash,
      status: "collected",
      metadata: JSON.stringify({
        promotedFromFindingId: finding.id,
        sourceName: finding.sourceName,
        agentGroup: finding.agentGroup,
        confidence: finding.confidence,
        investigationId: finding.investigationId,
      }),
    },
  });
  await prisma.evidenceCommit.create({
    data: {
      evidenceId: evidence.id,
      branchId: main.id,
      commitHash: createHash("sha256").update(`commit:${evidence.id}:initial`).digest("hex"),
      message: `add: promoted from finding ${finding.id.slice(0, 8)}`,
      authorId: "system",
      changeType: "add",
      diffSummary: `Promoted finding "${finding.title}" to forensic evidence.`,
    },
  });
  await prisma.finding.update({
    where: { id: finding.id },
    data: { evidenceId: evidence.id },
  });

  await appendAudit({
    action: "promote_finding_to_evidence",
    entity: "Finding",
    entityId: finding.id,
    caseId,
    investigationId: finding.investigationId,
    details: { evidenceId: evidence.id, hash },
  });

  return Response.json({ data: { evidence, evidenceId: evidence.id } }, { status: 201 });
}
