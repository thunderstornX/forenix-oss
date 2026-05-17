/**
 * POST /api/evidence/[id]/verify-bytes
 *
 * Re-hash the bytes on disk and compare against the stored hash. The
 * core "did anyone touch the bytes?" check for the chain-of-custody
 * promise. Appends an audit row with the result.
 */
import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  evidenceStorageEnabled,
  verifyEvidence,
} from "@/lib/evidence-store";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;

    if (!evidenceStorageEnabled()) {
      return Response.json(
        {
          error: "evidence_storage_unavailable",
          details:
            "Cannot re-hash files on a host without persistent storage. " +
            "Self-host to enable byte-level verification.",
        },
        { status: 503 },
      );
    }

    const ev = await prisma.evidence.findUnique({
      where: { id },
      select: {
        id: true,
        caseId: true,
        name: true,
        hash: true,
        objectKey: true,
        status: true,
      },
    });
    if (!ev) return Response.json({ error: "not_found" }, { status: 404 });
    if (!ev.objectKey) {
      return Response.json(
        {
          error: "no_object_key",
          details:
            "This evidence row has no stored bytes - it was created via " +
            "promote-from-finding or seeded data. Upload the actual file " +
            "to enable byte-level verification.",
        },
        { status: 409 },
      );
    }

    const { ok, actualSha256, byteCount } = await verifyEvidence(
      ev.objectKey,
      ev.hash,
    );

    await appendAudit({
      action: ok ? "verify_evidence_bytes_ok" : "verify_evidence_bytes_broken",
      entity: "Evidence",
      entityId: ev.id,
      userId: actor.userId,
      caseId: ev.caseId,
      details: {
        expected: ev.hash,
        actual: actualSha256,
        byteCount,
        objectKey: ev.objectKey,
      },
    });

    return Response.json({
      data: {
        ok,
        expectedSha256: ev.hash,
        actualSha256,
        byteCount,
        objectKey: ev.objectKey,
      },
    });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
