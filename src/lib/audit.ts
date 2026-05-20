/**
 * Audit-log hash-chain helpers.
 *
 * Every AuditLog row carries a `hash` that is the SHA-256 of:
 *   prevHash + action + entity + entityId + isoTimestamp
 *
 * `prevHash` points at the previous row's hash so the chain is
 * tamper-evident: replaying the SHA from row N against row (N-1)'s
 * hash must equal row N's hash, or the chain is broken.
 *
 * NOTE: the chain is keyed *globally* (no per-case shard) so the
 * Integrity Dashboard can verify the entire log with one pass.
 */
import "server-only";

import { prisma } from "./db";
import { computeAuditHash, GENESIS_HASH } from "./audit-chain";
import { emit } from "./events/emitter";

export { computeAuditHash, GENESIS_HASH } from "./audit-chain";

export interface AuditEntryInput {
  action: string;
  entity: string;
  entityId?: string | null;
  userId?: string | null;
  caseId?: string | null;
  investigationId?: string | null;
  details?: Record<string, unknown>;
  /** Phase 9.5: tenant scope for live-bus delivery. Pass actor.orgId
   *  from the route handler (or omit for system / single-tenant events). */
  orgId?: string | null;
}

/**
 * Append an entry to the audit log, computing the chain hash from
 * the previous row's hash. Returns the inserted row.
 */
export async function appendAudit(input: AuditEntryInput) {
  const prev = await prisma.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const prevHash = prev?.hash ?? GENESIS_HASH;
  const createdAt = new Date();
  const entityId = input.entityId ?? "";
  const hash = computeAuditHash({
    prevHash,
    action: input.action,
    entity: input.entity,
    entityId,
    createdAt,
  });

  const row = await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      userId: input.userId ?? null,
      caseId: input.caseId ?? null,
      investigationId: input.investigationId ?? null,
      details: JSON.stringify(input.details ?? {}),
      hash,
      prevHash,
      createdAt,
    },
  });

  // Broadcast on the live bus so the Audit view + topbar status can
  // refresh without polling. Fires once per append; consumers throttle
  // on their end if needed. `orgId` scopes delivery in SaaS mode; null
  // means "global" and reaches every subscriber (OSS default).
  emit(
    "audit.append",
    {
      hash,
      action: input.action,
      entity: input.entity,
    },
    input.orgId ?? null,
  );

  return row;
}

/**
 * Verify the full chain in insertion order.
 * Returns { ok: true } if every row's hash equals the recomputed
 * value, or { ok: false, brokenAt } pointing at the first
 * mismatched row.
 */
export async function verifyAuditChain(): Promise<
  { ok: true; entries: number } | { ok: false; brokenAt: string; expected: string; got: string; entries: number }
> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      hash: true,
      prevHash: true,
      createdAt: true,
    },
  });
  let prevHash = GENESIS_HASH;
  for (const row of rows) {
    const expected = computeAuditHash({
      prevHash,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId ?? "",
      createdAt: row.createdAt,
    });
    if (row.prevHash !== prevHash || row.hash !== expected) {
      return {
        ok: false,
        brokenAt: row.id,
        expected,
        got: row.hash ?? "",
        entries: rows.length,
      };
    }
    prevHash = row.hash!;
  }
  return { ok: true, entries: rows.length };
}
