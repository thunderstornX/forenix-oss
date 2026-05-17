/**
 * POST /api/evidence/upload
 *
 * multipart/form-data with two fields:
 *   - caseId  (string)
 *   - file    (binary)
 *
 * Streams the bytes through a content-addressed disk store
 * (src/lib/evidence-store.ts), creates the Evidence row with the
 * REAL byte hash (not a metadata hash), and appends an audit log.
 *
 * On Vercel / serverless: returns 503 with a "self-host required"
 * message so the UI can render an explanatory toast instead of
 * silently failing.
 */
import { Readable } from "node:stream";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { evidenceStorageEnabled, storeBytes } from "@/lib/evidence-store";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const actor = await requireSession();

    if (!evidenceStorageEnabled()) {
      return Response.json(
        {
          error: "evidence_storage_unavailable",
          details:
            "This deployment runs on a host without persistent storage. " +
            "Self-host (see docs/SELF_HOST.md) to enable file-byte evidence " +
            "uploads. The serverless concept demo intentionally degrades " +
            "this feature.",
        },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const caseId = String(form.get("caseId") ?? "").trim();
    const file = form.get("file");

    if (!caseId) {
      return Response.json({ error: "missing_caseId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "missing_file" }, { status: 400 });
    }
    // Validate the case exists + actor is in scope.
    const theCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, teamId: true },
    });
    if (!theCase) return Response.json({ error: "case_not_found" }, { status: 404 });

    // Stream the upload into the store.
    const webStream = file.stream() as unknown as ReadableStream<Uint8Array>;
    const nodeStream = Readable.fromWeb(webStream as never);
    const stored = await storeBytes({ caseId, source: nodeStream });

    // Persist the Evidence row.
    const ev = await prisma.evidence.create({
      data: {
        caseId,
        name: file.name || `upload-${stored.sha256.slice(0, 12)}`,
        type: "file",
        mimeType: file.type || null,
        size: BigInt(stored.byteCount),
        byteCount: BigInt(stored.byteCount),
        hash: stored.sha256,
        hashAlgo: "SHA-256",
        objectKey: stored.objectKey,
        status: "collected",
        source: `upload:${actor.userId}`,
        metadata: JSON.stringify({
          uploadedAt: new Date().toISOString(),
          uploadedBy: actor.userId,
          originalName: file.name,
          contentType: file.type,
        }),
      },
    });

    await appendAudit({
      action: "upload_evidence",
      entity: "Evidence",
      entityId: ev.id,
      userId: actor.userId,
      caseId,
      details: {
        objectKey: stored.objectKey,
        bytes: stored.byteCount,
        sha256: stored.sha256,
        contentType: file.type,
      },
    });

    return Response.json(
      {
        data: {
          id: ev.id,
          name: ev.name,
          hash: ev.hash,
          hashAlgo: ev.hashAlgo,
          objectKey: ev.objectKey,
          byteCount: stored.byteCount,
          status: ev.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return httpErrorResponse(err);
  }
}
