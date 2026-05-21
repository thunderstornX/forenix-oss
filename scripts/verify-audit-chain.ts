#!/usr/bin/env bun
/**
 * Verify the audit-log SHA-256 forward chain.
 *
 * Reads every AuditLog row in insertion order, recomputes each
 * row's hash from the previous row's hash plus the row's content,
 * and reports the first mismatch (or success). This is the
 * primary integrity check on the platform's security claim.
 *
 * Usage:
 *   bun run scripts/verify-audit-chain.ts
 *
 * Exit code 0 on a clean chain, 1 on a broken chain or error.
 *
 * Imports the canonical hash function from src/lib/audit-chain.ts,
 * which is intentionally Prisma-free + server-only-free so any
 * non-Next tooling can use it. For offline verification without
 * trusting either this script or the project's TypeScript code,
 * see the 12-line Python recipe in `docs/07-SECURITY.md` section 4.
 */
import { PrismaClient } from "@prisma/client";

import { computeAuditHash, GENESIS_HASH } from "../src/lib/audit-chain";

async function main() {
  const prisma = new PrismaClient();
  try {
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

    if (rows.length === 0) {
      console.log("audit log is empty; nothing to verify");
      return;
    }

    let prevHash = GENESIS_HASH;
    for (const row of rows) {
      const expected = computeAuditHash({
        prevHash,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId ?? "",
        createdAt: row.createdAt,
      });
      if (row.prevHash !== prevHash) {
        console.error(`✗ row ${row.id}: prevHash mismatch (expected ${prevHash}, got ${row.prevHash})`);
        process.exit(1);
      }
      if (row.hash !== expected) {
        console.error(`✗ row ${row.id}: hash mismatch (expected ${expected}, got ${row.hash})`);
        process.exit(1);
      }
      prevHash = row.hash;
    }

    console.log(`✓ audit chain verified (${rows.length} entries, head ${prevHash})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
