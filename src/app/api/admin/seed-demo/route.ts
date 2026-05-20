/**
 * POST /api/admin/seed-demo
 *
 * Idempotent demo-data initialiser for fresh Vercel deploys.
 * Authorised by a SEED_TOKEN env var (NOT by user session  -  needed
 * to bootstrap an empty database). On a non-empty database it
 * returns 409 unless `force: true` is provided AND the token matches.
 *
 * Reuses the same logic as prisma/seed.ts.
 */
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { computeAuditHash, GENESIS_HASH } from "@/lib/audit-chain";
import { prisma } from "@/lib/db";
import { timingSafeStringEqual } from "@/lib/security";

const Body = z.object({
  token: z.string().min(8),
  force: z.boolean().optional().default(false),
});

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(request: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (err) {
    return Response.json(
      { error: "invalid_body", details: (err as Error).message },
      { status: 400 },
    );
  }
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return Response.json({ error: "no_seed_token_configured" }, { status: 503 });
  }
  if (!timingSafeStringEqual(body.token, expected)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.count();
  if (existing > 0 && !body.force) {
    return Response.json(
      { error: "already_seeded", details: `${existing} users present  -  pass force:true to wipe` },
      { status: 409 },
    );
  }

  if (existing > 0 && body.force) {
    await prisma.auditLog.deleteMany();
    await prisma.report.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.monitorRun.deleteMany();
    await prisma.monitor.deleteMany();
    await prisma.pipelineSchedule.deleteMany();
    await prisma.annotation.deleteMany();
    await prisma.finding.deleteMany();
    await prisma.entityRelation.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.mergeRequest.deleteMany();
    await prisma.evidenceCommit.deleteMany();
    await prisma.evidence.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.caseMetric.deleteMany();
    await prisma.caseAssignment.deleteMany();
    await prisma.agentAssignment.deleteMany();
    await prisma.agentTask.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.case.deleteMany();
    await prisma.teamInvite.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.user.deleteMany();
  }

  const hash = await bcrypt.hash("forenix", 10);
  const admin = await prisma.user.create({
    data: { email: "admin@forenix-oss.local",        name: "Admin",            role: "admin",        passwordHash: hash },
  });
  const investigator = await prisma.user.create({
    data: { email: "investigator@forenix-oss.local", name: "Jay Investigator", role: "investigator", passwordHash: hash },
  });
  const analyst = await prisma.user.create({
    data: { email: "analyst@forenix-oss.local",      name: "Sam Analyst",      role: "analyst",      passwordHash: hash },
  });

  const team = await prisma.team.create({
    data: {
      name: "Forenix Demo",
      slug: "forenix-demo",
      description: "The default team that owns the demo dataset.",
      members: {
        create: [
          { userId: admin.id,        role: "owner"  },
          { userId: investigator.id, role: "admin"  },
          { userId: analyst.id,      role: "member" },
        ],
      },
    },
  });

  const theCase = await prisma.case.create({
    data: {
      title: "Operation Sandstone",
      description: "Cross-jurisdictional shell-corporation network  -  seeded demo case.",
      caseNumber: "CASE-2025-007",
      status: "investigating",
      priority: "high",
      progress: 35,
      teamId: team.id,
      assignments: {
        create: [
          { userId: investigator.id, role: "lead" },
          { userId: analyst.id, role: "analyst" },
        ],
      },
    },
  });

  await prisma.branch.create({
    data: {
      caseId: theCase.id,
      name: "main",
      isMain: true,
      status: "active",
      color: "#10b981",
      headHash: sha("genesis:" + theCase.id),
    },
  });

  await prisma.investigation.create({
    data: {
      title: "INV-2025-019  -  Northwind Holdings",
      target: "northwind-holdings.io",
      targetType: "domain",
      objective: "Identify beneficial owners and infrastructure footprint.",
      status: "complete",
      priority: "high",
      caseId: theCase.id,
      teamId: team.id,
    },
  });
  await prisma.investigation.create({
    data: {
      title: "INV-2025-020  -  Mira Volkov",
      target: "Mira Volkov",
      targetType: "person",
      objective: "Build identity profile + social adjacency map.",
      status: "draft",
      priority: "medium",
      teamId: team.id,
    },
  });

  // One-row audit (just so the chain is non-empty).
  const createdAt = new Date();
  const h = computeAuditHash({
    prevHash: GENESIS_HASH,
    action: "demo_seeded",
    entity: "System",
    entityId: "init",
    createdAt,
  });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "demo_seeded",
      entity: "System",
      entityId: "init",
      details: JSON.stringify({ seededAt: createdAt }),
      hash: h,
      prevHash: GENESIS_HASH,
      createdAt,
    },
  });

  return Response.json(
    {
      data: {
        users: 3,
        team: team.slug,
        case: theCase.caseNumber,
        message: "Demo data seeded. Sign in with admin@forenix-oss.local / forenix",
      },
    },
    { status: 201 },
  );
}
