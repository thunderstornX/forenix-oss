/**
 * GET /api/network
 *
 * Cross-case knowledge graph, scoped to the actor's tenant. Returns a
 * single union of users, agents, investigations, cases, evidence,
 * entities (joined via the in-scope relations), plus every relation we
 * can derive (case assignments, agent assignments, investigation→case
 * bridges, finding→evidence bridges, entity relations).
 *
 * Cross-tenant nodes are never emitted: the team/org filter applies to
 * Case and Investigation directly, and the rest of the graph inherits
 * scope through its parent.
 */
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

interface Node {
  id: string;
  kind: "user" | "agent" | "investigation" | "case" | "evidence" | "entity";
  label: string;
  meta?: Record<string, string | number | boolean | null>;
}
interface Edge {
  from: string;
  to: string;
  type: string;
  strength?: number;
}

export async function GET() {
  try {
    const actor = await requireSession();
    const scope = teamScopeWhere(actor);

    // Users + agents are deployment-global; everything else is
    // tenant-scoped through Case or Investigation.
    const [
      users, agents, cases, investigations, evidence,
      findings, relations, caseAssignments, agentAssignments,
    ] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      prisma.agent.findMany({ select: { id: true, name: true, type: true, status: true } }),
      prisma.case.findMany({
        where: scope,
        select: { id: true, title: true, caseNumber: true, status: true },
      }),
      prisma.investigation.findMany({
        where: scope,
        select: { id: true, title: true, target: true, status: true, caseId: true },
      }),
      prisma.evidence.findMany({
        where: { case: scope },
        select: { id: true, name: true, caseId: true, status: true },
      }),
      prisma.finding.findMany({
        where: { investigation: scope, evidenceId: { not: null } },
        select: { id: true, investigationId: true, evidenceId: true },
      }),
      prisma.entityRelation.findMany({
        where: { investigation: scope },
        select: { fromEntityId: true, toEntityId: true, relationType: true, investigationId: true },
      }),
      prisma.caseAssignment.findMany({
        where: { case: scope },
        select: { caseId: true, userId: true, role: true },
      }),
      prisma.agentAssignment.findMany({
        where: { case: scope },
        select: { caseId: true, agentId: true },
      }),
    ]);

    // Collect entity ids referenced by in-scope relations, then fetch
    // just those entities. (Entity itself carries no tenant column.)
    const entityIds = new Set<string>();
    for (const r of relations) {
      entityIds.add(r.fromEntityId);
      entityIds.add(r.toEntityId);
    }
    const entities = entityIds.size === 0
      ? []
      : await prisma.entity.findMany({
          where: { id: { in: Array.from(entityIds) } },
          select: { id: true, name: true, type: true },
        });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (const u of users) {
      nodes.push({ id: `user:${u.id}`, kind: "user", label: u.name, meta: { role: u.role } });
    }
    for (const a of agents) {
      nodes.push({ id: `agent:${a.id}`, kind: "agent", label: a.name, meta: { type: a.type, status: a.status } });
    }
    for (const c of cases) {
      nodes.push({ id: `case:${c.id}`, kind: "case", label: `${c.caseNumber} | ${c.title}`, meta: { status: c.status } });
    }
    for (const i of investigations) {
      nodes.push({ id: `inv:${i.id}`, kind: "investigation", label: i.title, meta: { target: i.target, status: i.status } });
      if (i.caseId) edges.push({ from: `inv:${i.id}`, to: `case:${i.caseId}`, type: "promoted_to" });
    }
    for (const ev of evidence) {
      nodes.push({ id: `ev:${ev.id}`, kind: "evidence", label: ev.name, meta: { status: ev.status } });
      if (ev.caseId) edges.push({ from: `case:${ev.caseId}`, to: `ev:${ev.id}`, type: "holds" });
    }
    for (const e of entities) {
      nodes.push({ id: `entity:${e.id}`, kind: "entity", label: e.name, meta: { type: e.type } });
    }
    for (const f of findings) {
      if (f.evidenceId) {
        edges.push({ from: `inv:${f.investigationId}`, to: `ev:${f.evidenceId}`, type: "evidence_finding" });
      }
    }
    for (const r of relations) {
      edges.push({ from: `entity:${r.fromEntityId}`, to: `entity:${r.toEntityId}`, type: r.relationType });
    }
    for (const ca of caseAssignments) {
      edges.push({ from: `user:${ca.userId}`, to: `case:${ca.caseId}`, type: ca.role });
    }
    for (const aa of agentAssignments) {
      edges.push({ from: `agent:${aa.agentId}`, to: `case:${aa.caseId}`, type: "assigned_to" });
    }

    return Response.json({ data: { nodes, edges } });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
