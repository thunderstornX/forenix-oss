import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  HttpError,
  httpErrorResponse,
  requireSession,
  teamScopeWhere,
} from "@/lib/rbac";

const VERDICTS = ["pending", "confirmed", "probable", "unverified", "disputed", "false"] as const;

const PatchBody = z.object({
  verdict: z.enum(VERDICTS),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    const body = PatchBody.parse(await request.json());

    // Scope-checked lookup before write: Verification inherits scope
    // through its parent Investigation. 404 if out of scope.
    const exists = await prisma.verification.findFirst({
      where: { id, investigation: teamScopeWhere(actor) },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "verification_not_found");

    const updated = await prisma.verification.update({
      where: { id },
      data: { verdict: body.verdict },
    });
    await appendAudit({
      action: "set_verification_verdict",
      entity: "Verification",
      entityId: id,
      userId: actor.userId,
      investigationId: updated.investigationId,
      details: { verdict: body.verdict },
    });
    return Response.json({ data: updated });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
