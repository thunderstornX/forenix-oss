#!/usr/bin/env bun
/**
 * Dump the audit log to stdout as JSON.
 *
 * The hash chain is the central security claim of forenix-oss.
 * This script lets a researcher (or any external party) export
 * the chain in a single command so they can verify it offline
 * with the recipe in `docs/07-SECURITY.md` section 4 or with
 * `scripts/verify-audit-chain.ts`.
 *
 * Usage:
 *   bun run scripts/dump-audit-log.ts > /tmp/audit.json
 *
 * Self-contained (no @-aliases, no server-only chain); safe to
 * run from any shell that can reach the database.
 */
import { PrismaClient } from "@prisma/client";

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
        userId: true,
        caseId: true,
        investigationId: true,
        details: true,
        hash: true,
        prevHash: true,
        createdAt: true,
      },
    });
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
