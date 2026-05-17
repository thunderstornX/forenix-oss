/**
 * GET /api/attestation/:id/verify
 *
 * Re-fetches the witness (HMAC recompute / GitHub comment GET / ...)
 * and confirms it still pins the original head. Read-only — does
 * not mutate the stored Attestation row.
 */
import { httpErrorResponse, requireSession } from "@/lib/rbac";
import { verifyAttestation } from "@/lib/attestation/service";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const { row, verdict } = await verifyAttestation(id);
    if (!row) {
      return Response.json({ error: "not_found", verdict }, { status: 404 });
    }
    return Response.json({ data: { row, verdict } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
