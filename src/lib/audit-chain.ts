/**
 * Pure hash-chain helpers  -  no Prisma, no `server-only` marker, so
 * the seed script and any non-Next tooling can import them.
 *
 * The runtime wrapper that ALSO appends to Prisma lives in
 * src/lib/audit.ts (which marks itself server-only and re-exports
 * the constants below for convenience).
 */
import { createHash } from "node:crypto";

/** Genesis hash for an empty log (32 zero bytes, hex-encoded). */
export const GENESIS_HASH = "0".repeat(64);

export function computeAuditHash(args: {
  prevHash: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: Date;
}): string {
  const h = createHash("sha256");
  h.update(args.prevHash);
  h.update("|");
  h.update(args.action);
  h.update("|");
  h.update(args.entity);
  h.update("|");
  h.update(args.entityId);
  h.update("|");
  h.update(args.createdAt.toISOString());
  return h.digest("hex");
}
