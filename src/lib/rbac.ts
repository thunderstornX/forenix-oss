/**
 * Server-only RBAC helpers.
 *
 * Three primitives:
 *   requireSession()         -  throws { status:401 } if not signed in.
 *   requireRole("admin")     -  throws { status:403 } if role mismatches.
 *   actorContext()           -  returns userId/role/teamIds for audit
 *                             writes + team-scoped queries.
 *
 * Role hierarchy:
 *   admin > investigator > analyst > viewer
 *
 * Within a team, TeamMember.role takes precedence for case-scoped
 * actions; the global role is used for everything cross-team.
 */
import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type GlobalRole = "admin" | "investigator" | "analyst" | "viewer";

const RANK: Record<GlobalRole, number> = {
  admin: 100,
  investigator: 60,
  analyst: 40,
  viewer: 10,
};

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export interface ActorContext {
  userId: string;
  email: string | null;
  name: string | null;
  role: GlobalRole;
  teamIds: string[];
  /** Phase 9.5: actor's primary org (NULL in OSS / unassigned). */
  orgId: string | null;
}

export async function requireSession(): Promise<ActorContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new HttpError(401, "unauthenticated");
  }
  const role = (session.user.role ?? "viewer") as GlobalRole;
  const teamIds = await prisma.teamMember
    .findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
    })
    .then((rows) => rows.map((r) => r.teamId));

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role,
    teamIds,
    orgId: session.user.orgId ?? null,
  };
}

export function requireRole(actor: ActorContext, atLeast: GlobalRole) {
  if (RANK[actor.role] < RANK[atLeast]) {
    throw new HttpError(403, "forbidden", `requires role ${atLeast}`);
  }
}

/** Returns a Prisma where-clause that scopes to the actor's teams,
 *  and (in SaaS, when `actor.orgId` is set) also to the actor's org.
 *
 *  Decision matrix:
 *
 *  | actor.role | actor.orgId | result                                                 |
 *  |------------|-------------|--------------------------------------------------------|
 *  | admin      | null        | {} — operator / super-admin sees everything            |
 *  | admin      | set         | { orgId } — sees everything within their org           |
 *  | non-admin  | null        | { OR: [team null, team in actor.teamIds] } — OSS legacy|
 *  | non-admin  | set         | AND of the two clauses above                           |
 *
 *  Called with models that carry both `teamId` and `orgId` (Investigation,
 *  Case, and Evidence-via-Case). New tenant-scoped models that join this
 *  party should also carry both columns. */
export function teamScopeWhere(actor: ActorContext) {
  // Operator / super-admin: role=admin AND no org → no scoping.
  // Covers OSS single-tenant deployments + the operator bootstrap account
  // on a SaaS deployment.
  if (actor.role === "admin" && !actor.orgId) return {};

  const orgClause = actor.orgId ? { orgId: actor.orgId } : null;
  const teamClause =
    actor.role === "admin"
      ? null  // admin within org: no team restriction inside the org
      : { OR: [{ teamId: null }, { teamId: { in: actor.teamIds } }] };

  if (orgClause && teamClause) return { AND: [orgClause, teamClause] };
  return orgClause ?? teamClause ?? {};
}

/** Tenant-aware lookup: returns the Case if the actor can see it, or
 *  throws 404. We return 404 (not 403) on out-of-scope so the route
 *  doesn't disclose the existence of cases the actor can't access. */
export async function requireCaseInScope(actor: ActorContext, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, ...teamScopeWhere(actor) },
    select: { id: true, teamId: true, orgId: true },
  });
  if (!c) throw new HttpError(404, "case_not_found");
  return c;
}

/** Tenant-aware lookup: returns the Investigation if the actor can see it,
 *  else throws 404. Same disclosure rule as requireCaseInScope. */
export async function requireInvestigationInScope(
  actor: ActorContext,
  investigationId: string,
) {
  const inv = await prisma.investigation.findFirst({
    where: { id: investigationId, ...teamScopeWhere(actor) },
    select: { id: true, teamId: true, orgId: true, caseId: true },
  });
  if (!inv) throw new HttpError(404, "investigation_not_found");
  return inv;
}

/** Evidence inherits scope from its parent Case. Returns the requested
 *  Evidence row (with the fields most read-paths need) or throws 404 if
 *  the parent case is not in scope. */
export async function requireEvidenceInScope(
  actor: ActorContext,
  evidenceId: string,
) {
  const ev = await prisma.evidence.findFirst({
    where: { id: evidenceId, case: teamScopeWhere(actor) },
    select: {
      id: true, caseId: true, name: true, mimeType: true, objectKey: true,
      byteCount: true, hash: true, hashAlgo: true, status: true,
      type: true, description: true, tags: true, metadata: true,
    },
  });
  if (!ev) throw new HttpError(404, "evidence_not_found");
  return ev;
}

/** Finding inherits scope from its parent Investigation. */
export async function requireFindingInScope(
  actor: ActorContext,
  findingId: string,
) {
  const f = await prisma.finding.findFirst({
    where: { id: findingId, investigation: teamScopeWhere(actor) },
  });
  if (!f) throw new HttpError(404, "finding_not_found");
  return f;
}

/** Report attaches to either a Case or an Investigation (or both). The
 *  actor sees it if they can see EITHER parent. */
export async function requireReportInScope(
  actor: ActorContext,
  reportId: string,
) {
  const scope = teamScopeWhere(actor);
  const r = await prisma.report.findFirst({
    where: {
      id: reportId,
      OR: [{ case: scope }, { investigation: scope }],
    },
  });
  if (!r) throw new HttpError(404, "report_not_found");
  return r;
}

/** Turn any HttpError into a Response.json. */
export function httpErrorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.code, details: err.message }, { status: err.status });
  }
  console.error("[rbac] unhandled error", err);
  return Response.json(
    { error: "internal_error", details: (err as Error).message ?? "" },
    { status: 500 },
  );
}
