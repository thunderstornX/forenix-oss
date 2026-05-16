import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { httpErrorResponse, requireRole, requireSession } from "@/lib/rbac";
import { listVault, removeVaultKey, setVaultKey } from "@/lib/vault";

const PutBody = z.object({
  envKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/),
  label: z.string().min(1).max(160),
  plaintext: z.string().min(8).max(2_000),
});
const DeleteBody = z.object({
  envKey: z.string().min(2),
});

export async function GET() {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const rows = await listVault();
    return Response.json({ data: rows });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const body = PutBody.parse(await request.json());
    await setVaultKey({
      envKey: body.envKey,
      label: body.label,
      plaintext: body.plaintext,
      setById: actor.userId,
    });
    await appendAudit({
      action: "admin_set_api_key",
      entity: "ApiKey",
      entityId: body.envKey,
      userId: actor.userId,
      details: { envKey: body.envKey, label: body.label },
    });
    return Response.json({ data: { ok: true, envKey: body.envKey } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireSession();
    requireRole(actor, "admin");
    const body = DeleteBody.parse(await request.json());
    await removeVaultKey(body.envKey);
    await appendAudit({
      action: "admin_remove_api_key",
      entity: "ApiKey",
      entityId: body.envKey,
      userId: actor.userId,
      details: { envKey: body.envKey },
    });
    return Response.json({ data: { ok: true } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
