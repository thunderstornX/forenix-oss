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
    const ev = await prisma.evidence.findUnique({ where: { id } });
    if (!ev) return Response.json({ error: "not_found" }, { status: 404 });
    if (ev.status === "sealed") {
      return Response.json({ error: "already_sealed" }, { status: 409 });
    }
    const updated = await prisma.evidence.update({
      where: { id },
      data: { status: "sealed" },
    });

    // Real Git: rewrite the evidence file with status=sealed and
    // commit on main. Sealed status persists in both the database
    // *and* the Git history of the case repo.
    await ensureCaseRepo(ev.caseId);
    await writeEvidenceFile(ev.caseId, {
      id: ev.id,
      name: ev.name,
      type: ev.type,
      mimeType: ev.mimeType,
      description: ev.description,
      hash: ev.hash,
      hashAlgo: ev.hashAlgo,
      status: "sealed",
      tags: ev.tags,
      metadata: JSON.parse(ev.metadata || "{}"),
    });
    const parentHead = await getBranchHead(ev.caseId, "main").catch(() => "");
    const oid = await commitChanges({
      caseId: ev.caseId,
      message: `seal: ${ev.name} — chain of custody locked`,
      authorName: actor.name ?? "analyst",
      authorEmail: actor.email ?? "analyst@forenix-oss.local",
    });

    const main = await prisma.branch.findFirst({
      where: { caseId: ev.caseId, isMain: true },
    });
    if (main) {
      await prisma.evidenceCommit.create({
        data: {
          evidenceId: id,
          branchId: main.id,
          parentHash: parentHead || null,
          commitHash: oid,
          message: "seal: evidence locked, no further mutations",
          authorId: actor.userId,
          changeType: "seal",
          verified: true,
          verifiedBy: actor.name ?? actor.userId,
          verifiedAt: new Date(),
        },
      });
      await prisma.branch.update({
        where: { id: main.id },
        data: { headHash: oid },
      });
    }

    await appendAudit({
      action: "seal_evidence",
      entity: "Evidence",
      entityId: id,
      caseId: ev.caseId,
      userId: actor.userId,
      details: { hash: ev.hash, gitOid: oid },
    });

    // Evidence.size is BigInt — coerce to string for JSON.
    const serialized = JSON.parse(
      JSON.stringify(updated, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    );
    return Response.json({ data: serialized });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
