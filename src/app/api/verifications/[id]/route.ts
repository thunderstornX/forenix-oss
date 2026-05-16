import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

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
