/**
 * POST /api/findings/[id]/promote
 *
 * Promote a single OSINT finding to a forensic evidence item.
 * Writes a real file in the case's Git repo and commits on main.
 * If the parent investigation isn't linked to a case yet, this
 * fails with 409 — caller should bridge first.
 */
import { createHash } from "node:crypto";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  commitChanges,
  ensureCaseRepo,
  getBranchHead,
  writeEvidenceFile,
} from "@/lib/git-engine";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    const finding = await prisma.finding.findUnique({
      where: { id },
      include: { investigation: { select: { id: true, caseId: true, title: true } } },
    });
    if (!finding) return Response.json({ error: "not_found" }, { status: 404 });
    if (finding.evidenceId) {
      return Response.json(
        { error: "already_promoted", evidenceId: finding.evidenceId },
        { status: 409 },
      );
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

    // Real Git: ensure repo, write evidence file, commit on main.
    await ensureCaseRepo(caseId);
    await writeEvidenceFile(caseId, {
      id: evidence.id,
      name: evidence.name,
      type: evidence.type,
      mimeType: evidence.mimeType,
      description: evidence.description,
      hash: evidence.hash,
      hashAlgo: evidence.hashAlgo,
      status: evidence.status,
      tags: evidence.tags,
      metadata: JSON.parse(evidence.metadata || "{}"),
    });
    const parentHead = await getBranchHead(caseId, "main").catch(() => "");
    const oid = await commitChanges({
      caseId,
      message: `add: promoted from finding ${finding.id.slice(0, 8)}`,
      authorName: actor.name ?? "analyst",
      authorEmail: actor.email ?? "analyst@forenix-oss.local",
    });

    await prisma.evidenceCommit.create({
      data: {
        evidenceId: evidence.id,
        branchId: main.id,
        parentHash: parentHead || null,
        commitHash: oid,
        message: `add: promoted from finding ${finding.id.slice(0, 8)}`,
        authorId: actor.userId,
        changeType: "add",
        diffSummary: `Promoted finding "${finding.title}" to forensic evidence.`,
      },
    });
    await prisma.branch.update({
      where: { id: main.id },
      data: { headHash: oid },
    });
    await prisma.finding.update({
      where: { id: finding.id },
      data: { evidenceId: evidence.id },
    });

    await appendAudit({
      action: "promote_finding_to_evidence",
      entity: "Finding",
      entityId: finding.id,
      userId: actor.userId,
      caseId,
      investigationId: finding.investigationId,
      details: { evidenceId: evidence.id, hash, gitOid: oid },
    });

    return Response.json({ data: { evidence, evidenceId: evidence.id } }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
