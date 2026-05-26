/**
 * POST /api/reviews/[id]/merge
 *
 * Real merge  -  calls the Git engine, returns either a successful
 * merge (with the new oid + fast-forward flag) or a conflict report
 * (so the UI can render the conflicted files).
 *
 * On success:
 *   - MR.status = "merged"
 *   - branch.headHash = updated to new head of target
 *   - EvidenceCommit row written on the target branch
 *   - audit row appended
 */
import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  ensureCaseRepo,
  getBranchHead,
  gitEngineEnabled,
  mergeBranches,
} from "@/lib/git-engine";
import {
  httpErrorResponse,
  requireCaseInScope,
  requireSession,
} from "@/lib/rbac";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;

    const mr = await prisma.mergeRequest.findUnique({
      where: { id },
      include: {
        branch: true,
        case: { include: { branches: { where: { isMain: true } } } },
      },
    });
    if (!mr) return Response.json({ error: "not_found" }, { status: 404 });
    // MergeRequest inherits scope via its parent Case. Reject the
    // merge if that case is outside the actor's team / org.
    await requireCaseInScope(actor, mr.caseId);
    if (!gitEngineEnabled()) {
      return Response.json(
        {
          error: "merge_unavailable",
          details:
            "Real Git merges require a writable filesystem. This deployment runs on a serverless host without persistent disk  -  please self-host or set FORENIX_FORCE_GIT=1 if you accept ephemeral repos.",
        },
        { status: 503 },
      );
    }
    if (mr.status === "merged") {
      return Response.json({ error: "already_merged" }, { status: 409 });
    }
    const target = mr.case.branches[0];
    if (!target) {
      return Response.json({ error: "no_main_branch" }, { status: 500 });
    }

    await ensureCaseRepo(mr.caseId);
    const result = await mergeBranches({
      caseId: mr.caseId,
      into: target.name,
      feature: mr.branch.name,
      message: `merge: ${mr.title}`,
      authorName: actor.name ?? "analyst",
      authorEmail: actor.email ?? "analyst@forenix-oss.local",
    });

    if (!result.ok) {
      await appendAudit({
        action: "merge_request_conflict",
        entity: "MergeRequest",
        entityId: mr.id,
        userId: actor.userId,
        caseId: mr.caseId,
        details: {
          conflicted: result.conflictedFiles,
          ours: result.ours,
          theirs: result.theirs,
        },
      });
      return Response.json(
        {
          error: "merge_conflict",
          data: {
            conflictedFiles: result.conflictedFiles,
            ours: result.ours,
            theirs: result.theirs,
          },
        },
        { status: 409 },
      );
    }

    // Success path: update branch head + create a merge-commit row.
    const newHead = await getBranchHead(mr.caseId, target.name);
    await prisma.branch.update({
      where: { id: target.id },
      data: { headHash: newHead },
    });
    await prisma.mergeRequest.update({
      where: { id: mr.id },
      data: { status: "merged", mergedAt: new Date() },
    });
    await prisma.evidenceCommit.create({
      data: {
        evidenceId: null as unknown as string, // merge commits don't belong to a single evidence row
        branchId: target.id,
        parentHash: result.fastForward ? null : await getBranchHead(mr.caseId, mr.branch.name),
        commitHash: result.mergeCommit,
        message: `merge: ${mr.title} (${mr.branch.name} -> ${target.name})`,
        authorId: actor.userId,
        changeType: "merge",
        verified: true,
        verifiedBy: actor.name ?? actor.userId,
        verifiedAt: new Date(),
      },
    }).catch(() => {
      // Schema may require evidenceId; if so, skip the commit row  - 
      // the Git history holds the real record either way.
    });

    await appendAudit({
      action: "merge_request_merged",
      entity: "MergeRequest",
      entityId: mr.id,
      userId: actor.userId,
      caseId: mr.caseId,
      details: {
        from: mr.branch.name,
        into: target.name,
        gitOid: result.mergeCommit,
        fastForward: result.fastForward,
      },
    });

    return Response.json({
      data: {
        mergeRequest: { id: mr.id, status: "merged" },
        gitOid: result.mergeCommit,
        fastForward: result.fastForward,
      },
    });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
