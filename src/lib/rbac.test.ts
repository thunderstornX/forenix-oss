/**
 * Multi-tenant scope isolation test.
 *
 * Spins up a fresh SQLite DB in `/tmp`, pushes the live Prisma schema
 * into it, seeds two orgs/teams with cases, investigations, evidence,
 * findings, and reports, then exercises every scope helper to confirm:
 *
 *   - Actors in team A can read team-A resources.
 *   - Actors in team A get 404 (not 403) for team-B resources, so we
 *     never disclose existence to out-of-scope tenants.
 *   - The operator account (admin without an org) can see everything.
 *   - An admin scoped to an org sees only resources within their org.
 *
 * This is the canonical "cross-team bridge" probe. If a future change
 * removes a scope filter or adds a new tenant-bearing model without
 * wiring it in, this test should catch it.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

// Env first. The Prisma singleton in src/lib/db.ts reads DATABASE_URL
// at first instantiation, so we have to set it before anything that
// transitively imports `./db` (rbac, audit, etc) loads.
const tmp = mkdtempSync(join(tmpdir(), "forenix-rbac-"));
const dbFile = join(tmp, "test.db");
const dbUrl = `file:${dbFile}`;
process.env.DATABASE_URL = dbUrl;

// Push the schema synchronously before any prisma import wakes up.
const push = spawnSync(
  "bunx",
  ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
  { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: "pipe" },
);
if (push.status !== 0) {
  throw new Error(
    `prisma db push failed: ${push.stderr?.toString() ?? push.stdout?.toString()}`,
  );
}

// Now safe to import rbac (which transitively imports db with the
// right DATABASE_URL already in env).
const rbac = await import("./rbac");
const dbMod = await import("./db");
const prisma = dbMod.prisma;
const {
  HttpError,
  requireCaseInScope,
  requireEvidenceInScope,
  requireFindingInScope,
  requireInvestigationInScope,
  requireReportInScope,
  teamScopeWhere,
} = rbac;
type ActorContext = import("./rbac").ActorContext;

interface Fixture {
  orgA: string;
  orgB: string;
  teamA: string;
  teamB: string;
  userOperator: string;
  userAdminA: string;
  userAnalystA: string;
  userAnalystB: string;
  caseA: string;
  caseB: string;
  investigationA: string;
  investigationB: string;
  evidenceA: string;
  evidenceB: string;
  findingA: string;
  findingB: string;
  reportA: string;
  reportB: string;
}
let fx: Fixture;

function actor(partial: Partial<ActorContext>): ActorContext {
  return {
    userId: "u_test",
    email: null,
    name: null,
    role: "investigator",
    teamIds: [],
    orgId: null,
    ...partial,
  };
}

beforeAll(async () => {
  const orgA = (await prisma.organization.create({
    data: { id: "org_A", name: "Org A", slug: "org-a" },
  })).id;
  const orgB = (await prisma.organization.create({
    data: { id: "org_B", name: "Org B", slug: "org-b" },
  })).id;

  const teamA = (
    await prisma.team.create({ data: { id: "team_A", name: "Team A", slug: "team-a", orgId: orgA } })
  ).id;
  const teamB = (
    await prisma.team.create({ data: { id: "team_B", name: "Team B", slug: "team-b", orgId: orgB } })
  ).id;

  const userOperator = (
    await prisma.user.create({
      data: { id: "u_op", email: "op@example.com", name: "operator", role: "admin" },
    })
  ).id;
  const userAdminA = (
    await prisma.user.create({
      data: { id: "u_admA", email: "adminA@example.com", name: "adminA", role: "admin", orgId: orgA },
    })
  ).id;
  const userAnalystA = (
    await prisma.user.create({
      data: { id: "u_anaA", email: "anaA@example.com", name: "anaA", role: "analyst", orgId: orgA },
    })
  ).id;
  const userAnalystB = (
    await prisma.user.create({
      data: { id: "u_anaB", email: "anaB@example.com", name: "anaB", role: "analyst", orgId: orgB },
    })
  ).id;
  await prisma.teamMember.createMany({
    data: [
      { teamId: teamA, userId: userAnalystA, role: "member" },
      { teamId: teamB, userId: userAnalystB, role: "member" },
    ],
  });

  const caseA = (
    await prisma.case.create({
      data: {
        title: "Case A", description: "scope test case",
        caseNumber: "CASE-A-001", teamId: teamA, orgId: orgA,
      },
    })
  ).id;
  const caseB = (
    await prisma.case.create({
      data: {
        title: "Case B", description: "scope test case",
        caseNumber: "CASE-B-001", teamId: teamB, orgId: orgB,
      },
    })
  ).id;

  const investigationA = (
    await prisma.investigation.create({
      data: {
        title: "Inv A", target: "a.example", targetType: "domain", objective: "scope test",
        teamId: teamA, orgId: orgA, caseId: caseA,
      },
    })
  ).id;
  const investigationB = (
    await prisma.investigation.create({
      data: {
        title: "Inv B", target: "b.example", targetType: "domain", objective: "scope test",
        teamId: teamB, orgId: orgB, caseId: caseB,
      },
    })
  ).id;

  const evidenceA = (
    await prisma.evidence.create({
      data: { caseId: caseA, name: "ev A", type: "file", hash: "ah" },
    })
  ).id;
  const evidenceB = (
    await prisma.evidence.create({
      data: { caseId: caseB, name: "ev B", type: "file", hash: "bh" },
    })
  ).id;

  const findingA = (
    await prisma.finding.create({
      data: {
        investigationId: investigationA, title: "Find A", description: "team A finding",
        category: "identity", agentGroup: "identity", sourceName: "test",
      },
    })
  ).id;
  const findingB = (
    await prisma.finding.create({
      data: {
        investigationId: investigationB, title: "Find B", description: "team B finding",
        category: "identity", agentGroup: "identity", sourceName: "test",
      },
    })
  ).id;

  const reportA = (
    await prisma.report.create({
      data: { title: "Report A", source: "case", type: "summary", caseId: caseA },
    })
  ).id;
  const reportB = (
    await prisma.report.create({
      data: { title: "Report B", source: "investigation", type: "summary", investigationId: investigationB },
    })
  ).id;

  fx = {
    orgA, orgB, teamA, teamB,
    userOperator, userAdminA, userAnalystA, userAnalystB,
    caseA, caseB, investigationA, investigationB,
    evidenceA, evidenceB, findingA, findingB, reportA, reportB,
  };
});

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});

async function expect404<T>(p: Promise<T>) {
  try {
    await p;
    throw new Error("expected 404");
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as InstanceType<typeof HttpError>).status).toBe(404);
  }
}

describe("teamScopeWhere", () => {
  it("returns empty for operator (admin with no org)", () => {
    const a = actor({ role: "admin", orgId: null });
    expect(teamScopeWhere(a)).toEqual({});
  });

  it("returns orgId clause for admin scoped to an org", () => {
    const a = actor({ role: "admin", orgId: "org_A" });
    expect(teamScopeWhere(a)).toEqual({ orgId: "org_A" });
  });

  it("returns team-OR clause for OSS non-admin", () => {
    const a = actor({ role: "analyst", orgId: null, teamIds: ["team_A"] });
    expect(teamScopeWhere(a)).toEqual({
      OR: [{ teamId: null }, { teamId: { in: ["team_A"] } }],
    });
  });

  it("returns AND of org + team clauses for SaaS non-admin", () => {
    const a = actor({ role: "analyst", orgId: "org_A", teamIds: ["team_A"] });
    expect(teamScopeWhere(a)).toEqual({
      AND: [
        { orgId: "org_A" },
        { OR: [{ teamId: null }, { teamId: { in: ["team_A"] } }] },
      ],
    });
  });
});

describe("requireCaseInScope: cross-team isolation", () => {
  it("Team A analyst reads Case A", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    const c = await requireCaseInScope(a, fx.caseA);
    expect(c.id).toBe(fx.caseA);
  });

  it("Team A analyst gets 404 on Case B", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    await expect404(requireCaseInScope(a, fx.caseB));
  });

  it("Org A admin reads Case A but not Case B", async () => {
    const a = actor({ userId: fx.userAdminA, role: "admin", orgId: fx.orgA });
    const ok = await requireCaseInScope(a, fx.caseA);
    expect(ok.id).toBe(fx.caseA);
    await expect404(requireCaseInScope(a, fx.caseB));
  });

  it("Operator (admin, no org) reads both", async () => {
    const op = actor({ userId: fx.userOperator, role: "admin", orgId: null });
    expect((await requireCaseInScope(op, fx.caseA)).id).toBe(fx.caseA);
    expect((await requireCaseInScope(op, fx.caseB)).id).toBe(fx.caseB);
  });
});

describe("requireInvestigationInScope: cross-team isolation", () => {
  it("Team A analyst reads Inv A, 404 on Inv B", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    expect((await requireInvestigationInScope(a, fx.investigationA)).id).toBe(fx.investigationA);
    await expect404(requireInvestigationInScope(a, fx.investigationB));
  });

  it("Team B analyst reads Inv B, 404 on Inv A", async () => {
    const b = actor({ userId: fx.userAnalystB, role: "analyst", orgId: fx.orgB, teamIds: [fx.teamB] });
    expect((await requireInvestigationInScope(b, fx.investigationB)).id).toBe(fx.investigationB);
    await expect404(requireInvestigationInScope(b, fx.investigationA));
  });
});

describe("requireEvidenceInScope: scope inherits via Case", () => {
  it("Team A analyst reads Evidence A, 404 on Evidence B", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    expect((await requireEvidenceInScope(a, fx.evidenceA)).id).toBe(fx.evidenceA);
    await expect404(requireEvidenceInScope(a, fx.evidenceB));
  });
});

describe("requireFindingInScope: scope inherits via Investigation", () => {
  it("Team A analyst reads Finding A, 404 on Finding B", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    expect((await requireFindingInScope(a, fx.findingA))?.id).toBe(fx.findingA);
    await expect404(requireFindingInScope(a, fx.findingB));
  });
});

describe("Monitor scope via Investigation (v0.5.6 sweep)", () => {
  let monitorA: string;
  let monitorB: string;
  beforeAll(async () => {
    monitorA = (await prisma.monitor.create({
      data: { investigationId: fx.investigationA, target: "a.example", targetType: "domain" },
    })).id;
    monitorB = (await prisma.monitor.create({
      data: { investigationId: fx.investigationB, target: "b.example", targetType: "domain" },
    })).id;
  });

  it("Team A analyst sees only Monitor A in the list", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    const rows = await prisma.monitor.findMany({
      where: { investigation: teamScopeWhere(a) },
      select: { id: true },
    });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(monitorA);
    expect(ids).not.toContain(monitorB);
  });

  it("Team A analyst cannot fetch Monitor B by id", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    const m = await prisma.monitor.findFirst({
      where: { id: monitorB, investigation: teamScopeWhere(a) },
    });
    expect(m).toBeNull();
  });
});

describe("Verification scope via Investigation (v0.5.6 sweep)", () => {
  let verA: string;
  let verB: string;
  beforeAll(async () => {
    verA = (await prisma.verification.create({
      data: { investigationId: fx.investigationA, claim: "claim A", claimType: "text" },
    })).id;
    verB = (await prisma.verification.create({
      data: { investigationId: fx.investigationB, claim: "claim B", claimType: "text" },
    })).id;
  });

  it("Team A analyst cannot patch Verification B", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    const v = await prisma.verification.findFirst({
      where: { id: verB, investigation: teamScopeWhere(a) },
    });
    expect(v).toBeNull();
  });

  it("Team A analyst can patch Verification A", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    const v = await prisma.verification.findFirst({
      where: { id: verA, investigation: teamScopeWhere(a) },
    });
    expect(v?.id).toBe(verA);
  });
});

describe("AuditLog scope via parent Case OR Investigation (v0.5.6 sweep)", () => {
  let auditA: string;
  let auditB: string;
  beforeAll(async () => {
    auditA = (await prisma.auditLog.create({
      data: {
        action: "test", entity: "Case", entityId: fx.caseA,
        caseId: fx.caseA, hash: "ah", prevHash: "0",
      },
    })).id;
    auditB = (await prisma.auditLog.create({
      data: {
        action: "test", entity: "Investigation", entityId: fx.investigationB,
        investigationId: fx.investigationB, hash: "bh", prevHash: "0",
      },
    })).id;
  });

  it("Team A analyst sees the case-A audit row but not the inv-B audit row", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    const scope = teamScopeWhere(a);
    const rows = await prisma.auditLog.findMany({
      where: { OR: [{ case: scope }, { investigation: scope }] },
      select: { id: true },
    });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(auditA);
    expect(ids).not.toContain(auditB);
  });
});

describe("requireReportInScope: scope inherits via Case OR Investigation", () => {
  it("Team A analyst reads Report A (caseId), 404 on Report B (investigationId)", async () => {
    const a = actor({ userId: fx.userAnalystA, role: "analyst", orgId: fx.orgA, teamIds: [fx.teamA] });
    expect((await requireReportInScope(a, fx.reportA))?.id).toBe(fx.reportA);
    await expect404(requireReportInScope(a, fx.reportB));
  });

  it("Team B analyst reads Report B (investigationId), 404 on Report A (caseId)", async () => {
    const b = actor({ userId: fx.userAnalystB, role: "analyst", orgId: fx.orgB, teamIds: [fx.teamB] });
    expect((await requireReportInScope(b, fx.reportB))?.id).toBe(fx.reportB);
    await expect404(requireReportInScope(b, fx.reportA));
  });
});
