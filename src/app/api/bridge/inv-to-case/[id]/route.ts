/**
 * POST /api/bridge/inv-to-case/[id]
 *
 * Opens a forensic Case from an OSINT investigation and links the
 * two via `Investigation.caseId`. If the investigation is already
 * linked, the existing case is returned unchanged.
 *
 * Optionally promotes findings to evidence (`promoteFindings: true`),
 * creating an Evidence row per finding and stamping
 * `Finding.evidenceId` on the bridge.
 */
import { createHash } from "node:crypto";

import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  commitChanges,
  ensureCaseRepo,
  getBranchHead,
  writeEvidenceFile,
} from "@/lib/git-engine";

const Body = z.object({
  caseTitle: z.string().min(3).max(200).optional(),
  promoteFindings: z.boolean().optional().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inv = await prisma.investigation.findUnique({
    where: { id },
    include: { findings: true },
  });
  if (!inv) {
    return Response.json({ error: "investigation_not_found" }, { status: 404 });
  }
  if (inv.caseId) {
    const existing = await prisma.case.findUnique({ where: { id: inv.caseId } });
    return Response.json({ data: { case: existing, alreadyLinked: true } });
  }

  let parsed: z.infer<typeof Body>;
  try {
    const raw = await request.text();
    parsed = Body.parse(raw.trim() === "" ? {} : JSON.parse(raw));
  } catch (err) {
    return Response.json(
      { error: "invalid_body", details: (err as Error).message },
      { status: 400 },
    );
  }

  const count = await prisma.case.count();
  const year = new Date().getFullYear();
  const caseNumber = `CASE-${year}-${String(count + 1).padStart(3, "0")}`;

  const created = await prisma.case.create({
    data: {
      title: parsed.caseTitle ?? `${inv.title} — forensic follow-up`,
      description: `Forensic case opened from investigation ${inv.title}. Target: ${inv.target}`,
      priority: inv.priority,
      caseNumber,
      status: "open",
      progress: 5,
      branches: {
        create: {
          name: "main",
          isMain: true,
          status: "active",
          color: "#10b981",
        },
      },
    },
    include: { branches: true },
  });

  // Provision a real Git repo for this case and capture the initial-
  // commit oid on the main branch row.
  await ensureCaseRepo(created.id, {
    title: created.title,
    description: created.description,
  });
  const mainBranchRow = created.branches.find((b) => b.isMain) ?? created.branches[0]!;
  const mainHead = await getBranchHead(created.id, "main");
  await prisma.branch.update({
    where: { id: mainBranchRow.id },
    data: { headHash: mainHead },
  });

  await prisma.investigation.update({
    where: { id },
    data: { caseId: created.id },
  });

  await appendAudit({
    action: "bridge_investigation_to_case",
    entity: "Case",
    entityId: created.id,
    caseId: created.id,
    investigationId: id,
    details: { caseNumber: created.caseNumber },
  });

  // Optionally promote each finding into an Evidence row, writing
  // each one as a real file in the case's Git repo and committing
  // on main.
  let promoted = 0;
  if (parsed.promoteFindings && inv.findings.length > 0) {
    const main = mainBranchRow;
    for (const f of inv.findings) {
      const hash = createHash("sha256")
        .update(`finding:${f.id}:${f.title}:${f.description}`)
        .digest("hex");
      const ev = await prisma.evidence.create({
        data: {
          caseId: created.id,
          name: `Finding ${f.id.slice(0, 8)} — ${f.title}`,
          type: "document",
          mimeType: "application/x-osint-finding",
          description: f.description,
          tags: `osint,${f.agentGroup}`,
          hash,
          status: "collected",
          metadata: JSON.stringify({
            promotedFromFindingId: f.id,
            sourceName: f.sourceName,
            agentGroup: f.agentGroup,
            confidence: f.confidence,
            investigationId: id,
          }),
        },
      });
      // Real Git: write the evidence file, then commit.
      await writeEvidenceFile(created.id, {
        id: ev.id,
        name: ev.name,
        type: ev.type,
        mimeType: ev.mimeType,
        description: ev.description,
        hash: ev.hash,
        hashAlgo: ev.hashAlgo,
        status: ev.status,
        tags: ev.tags,
        metadata: JSON.parse(ev.metadata || "{}"),
      });
      const parentHead = await getBranchHead(created.id, "main");
      const oid = await commitChanges({
        caseId: created.id,
        message: `add: promoted from finding ${f.id.slice(0, 8)}`,
      });
      await prisma.evidenceCommit.create({
        data: {
          evidenceId: ev.id,
          branchId: main.id,
          parentHash: parentHead,
          commitHash: oid,
          message: `add: promoted from finding ${f.id.slice(0, 8)}`,
          authorId: "system",
          changeType: "add",
          diffSummary: `Promoted finding "${f.title}" to forensic evidence.`,
        },
      });
      await prisma.finding.update({
        where: { id: f.id },
        data: { evidenceId: ev.id },
      });
      promoted++;
    }
    // Update the branch row's head to the latest real oid.
    if (promoted > 0) {
      const finalHead = await getBranchHead(created.id, "main");
      await prisma.branch.update({
        where: { id: main.id },
        data: { headHash: finalHead },
      });
    }
    await appendAudit({
      action: "findings_promoted_to_evidence",
      entity: "Case",
      entityId: created.id,
      caseId: created.id,
      investigationId: id,
      details: { promoted },
    });
  }

  return Response.json(
    {
      data: {
        case: created,
        promoted,
        alreadyLinked: false,
      },
    },
    { status: 201 },
  );
}
