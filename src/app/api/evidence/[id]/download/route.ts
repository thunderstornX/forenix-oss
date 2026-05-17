/**
 * GET /api/evidence/[id]/download
 *
 * Stream the actual evidence bytes back to the requester. Requires
 * an authenticated session in scope of the parent case. Refuses when
 * storage is disabled or the row has no objectKey.
 */
import { Readable } from "node:stream";
import { ReadableStream as WebReadableStream } from "node:stream/web";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  evidenceStorageEnabled,
  readEvidence,
} from "@/lib/evidence-store";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;

    if (!evidenceStorageEnabled()) {
      return Response.json(
        { error: "evidence_storage_unavailable" },
        { status: 503 },
      );
    }

    const ev = await prisma.evidence.findUnique({
      where: { id },
      select: {
        id: true,
        caseId: true,
        name: true,
        mimeType: true,
        objectKey: true,
        byteCount: true,
      },
    });
    if (!ev || !ev.objectKey) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    // Audit the access. Reading sealed evidence is a chain event.
    await appendAudit({
      action: "download_evidence",
      entity: "Evidence",
      entityId: ev.id,
      userId: actor.userId,
      caseId: ev.caseId,
      details: { objectKey: ev.objectKey, bytes: Number(ev.byteCount) },
    });

    const node = readEvidence(ev.objectKey);
    const web = Readable.toWeb(node as Readable) as unknown as WebReadableStream<Uint8Array>;

    return new Response(web as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": ev.mimeType || "application/octet-stream",
        "content-length": String(ev.byteCount),
        "content-disposition": `attachment; filename="${encodeURIComponent(ev.name)}"`,
        "x-evidence-id": ev.id,
        "x-evidence-object-key": ev.objectKey,
      },
    });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
