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
  };
}

export function requireRole(actor: ActorContext, atLeast: GlobalRole) {
  if (RANK[actor.role] < RANK[atLeast]) {
    throw new HttpError(403, "forbidden", `requires role ${atLeast}`);
  }
}

/** Returns a Prisma where-clause that scopes to the actor's teams.
 *  Admins see everything; everyone else sees rows owned by a team
 *  they're a member of, plus rows without a team (legacy/global). */
export function teamScopeWhere(actor: ActorContext) {
  if (actor.role === "admin") return {};
  return {
    OR: [
      { teamId: null },
      { teamId: { in: actor.teamIds } },
    ],
  };
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
