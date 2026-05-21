#!/usr/bin/env bun
/**
 * Backfill a real Git repository for a Case that was seeded before
 * the git-engine wired up (or for any Case whose `case-repos/<id>/`
 * directory has gone missing).
 *
 * Walks the case's Evidence rows, writes each as a file in the
 * repo, commits, and updates the `main` branch's headHash to the
 * resulting real git oid.
 *
 * Usage:
 *   bun run scripts/backfill-case-repo.ts <caseId>
 *
 * Idempotent: skips files that already exist in the repo at the
 * same hash; rebuilds the branch headHash regardless.
 */
import { PrismaClient } from "@prisma/client";

import {
  commitChanges,
  ensureCaseRepo,
  getBranchHead,
  gitEngineEnabled,
  writeEvidenceFile,
} from "../src/lib/git-engine";

async function main() {
  const caseId = process.argv[2];
  if (!caseId) {
    console.error("Usage: bun scripts/backfill-case-repo.ts <caseId>");
    process.exit(1);
  }

  if (!gitEngineEnabled()) {
    console.error("git engine is disabled in this environment (no spawn allowed)");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, caseNumber: true, title: true, description: true },
    });
    if (!c) {
      console.error(`case ${caseId} not found`);
      process.exit(1);
    }
    console.log(`── backfilling ${c.caseNumber} (${c.id}) ──`);

    await ensureCaseRepo(c.id, { title: c.title, description: c.description });
    console.log("  ✓ case repo ensured");

    const evidence = await prisma.evidence.findMany({
      where: { caseId: c.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, type: true, mimeType: true,
        description: true, hash: true, hashAlgo: true,
        status: true, tags: true, metadata: true,
      },
    });
    console.log(`  found ${evidence.length} evidence row(s)`);

    let committed = 0;
    for (const ev of evidence) {
      try {
        await writeEvidenceFile(c.id, {
          id: ev.id,
          name: ev.name,
          type: ev.type,
          mimeType: ev.mimeType,
          description: ev.description,
          hash: ev.hash,
          hashAlgo: ev.hashAlgo,
          status: ev.status,
          tags: ev.tags,
          metadata: JSON.parse(ev.metadata || "{}"),
        });
        await commitChanges({
          caseId: c.id,
          message: `backfill: seeded evidence ${ev.id.slice(0, 8)} (${ev.name})`,
        });
        committed += 1;
        console.log(`  ✓ committed ${ev.name}`);
      } catch (err) {
        console.warn(`  ! ${ev.name}: ${(err as Error).message}`);
      }
    }

    const head = await getBranchHead(c.id, "main");
    const updated = await prisma.branch.updateMany({
      where: { caseId: c.id, name: "main" },
      data: { headHash: head },
    });
    console.log(`  ✓ branch main headHash → ${head} (${updated.count} row updated)`);
    console.log(`── done: ${committed}/${evidence.length} evidence rows committed ──`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
