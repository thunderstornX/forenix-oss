/**
 * /api/attestation
 *
 * GET   — list recent attestations (any signed-in user; read-only).
 * POST  — kick off a new attestation (admin-only). Optional `backend`
 *         in the body overrides the env default for this run only.
 */
import { z } from "zod";

import { prisma } from "@/lib/db";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";
import { listAttestationBackends } from "@/lib/attestation/factory";
import { runAttestation } from "@/lib/attestation/service";

const PostBody = z.object({
  backend: z.string().min(1).max(32).optional(),
});

export async function GET() {
  try {
    await requireSession();
    const rows = await prisma.attestation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const backends = listAttestationBackends().map((b) => ({
      name: b.name,
      description: b.description,
    }));
    return Response.json({ data: rows, backends });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const body = await request.json().catch(() => ({}));
    const parsed = PostBody.parse(body);
    const row = await runAttestation({
      backend: parsed.backend,
      actorId: actor.userId,
    });
    return Response.json({ data: row });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
