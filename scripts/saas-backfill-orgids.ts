#!/usr/bin/env bun
/**
 * One-off backfill for Phase 9.5 multi-tenant migration.
 *
 * Two modes (use whichever fits your data):
 *
 *   --from-team
 *     For every Investigation / Case that has a non-null teamId,
 *     copy team.orgId onto the row. Use this when teams already
 *     carry an orgId (typical after running saas-create-org.ts
 *     with --attach-all-users).
 *
 *   --all-to <slug>
 *     For every Investigation / Case with NO team and NO orgId,
 *     assign them to the named org. Use this on a single-tenant
 *     droplet that just got promoted to SaaS mode, where every
 *     existing row should land in the one bootstrap org.
 *
 * Modes can be combined — run --from-team first, then --all-to to
 * sweep the remaining unscoped rows.
 *
 * Self-contained (no @/lib/db import); safe to run from any shell
 * that can reach the database.
 */
import { PrismaClient } from "@prisma/client";

interface Args {
  fromTeam: boolean;
  allTo?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { fromTeam: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from-team") out.fromTeam = true;
    if (argv[i] === "--all-to") out.allTo = argv[i + 1];
  }
  if (!out.fromTeam && !out.allTo) {
    console.error("Usage: bun scripts/saas-backfill-orgids.ts (--from-team | --all-to <slug>)");
    process.exit(1);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    if (args.fromTeam) {
      console.log("── --from-team: copying team.orgId onto Investigation/Case ──");
      const teams = await prisma.team.findMany({
        where: { orgId: { not: null } },
        select: { id: true, orgId: true, name: true },
      });
      for (const t of teams) {
        if (!t.orgId) continue;
        const invs = await prisma.investigation.updateMany({
          where: { teamId: t.id, orgId: null },
          data: { orgId: t.orgId },
        });
        const cases = await prisma.case.updateMany({
          where: { teamId: t.id, orgId: null },
          data: { orgId: t.orgId },
        });
        console.log(`  team "${t.name}" → ${invs.count} investigation(s), ${cases.count} case(s) backfilled`);
      }
    }

    if (args.allTo) {
      console.log(`── --all-to ${args.allTo}: assigning every unscoped row to org "${args.allTo}" ──`);
      const org = await prisma.organization.findUnique({
        where: { slug: args.allTo },
        select: { id: true, name: true },
      });
      if (!org) {
        console.error(`✗ org with slug "${args.allTo}" not found.`);
        process.exit(1);
      }
      const invs = await prisma.investigation.updateMany({
        where: { orgId: null },
        data: { orgId: org.id },
      });
      const cases = await prisma.case.updateMany({
        where: { orgId: null },
        data: { orgId: org.id },
      });
      console.log(`  "${org.name}" → ${invs.count} investigation(s), ${cases.count} case(s) backfilled`);
    }

    // Summary
    const stats = {
      organizations: await prisma.organization.count(),
      investigations: {
        total: await prisma.investigation.count(),
        unscoped: await prisma.investigation.count({ where: { orgId: null } }),
      },
      cases: {
        total: await prisma.case.count(),
        unscoped: await prisma.case.count({ where: { orgId: null } }),
      },
      teams: {
        total: await prisma.team.count(),
        unscoped: await prisma.team.count({ where: { orgId: null } }),
      },
      users: {
        total: await prisma.user.count(),
        unscoped: await prisma.user.count({ where: { orgId: null } }),
      },
    };
    console.log("");
    console.log("── final ──");
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
