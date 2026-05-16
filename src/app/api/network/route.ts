/**
 * GET /api/network
 *
 * Cross-case knowledge graph. Returns a single union of:
 *   - Users (analysts)
 *   - Agents (AI workers)
 *   - Investigations
 *   - Cases
 *   - Evidence
 *   - Entities (OSINT side)
 *
 * …plus every relation we can derive: case assignments, agent
 * assignments, investigation→case bridges, finding→evidence
 * bridges, entity relations.
 */
import { prisma } from "@/lib/db";

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
  const [users, agents, cases, investigations, evidence, entities, findings, relations, caseAssignments, agentAssignments] =
    await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      prisma.agent.findMany({ select: { id: true, name: true, type: true, status: true } }),
      prisma.case.findMany({ select: { id: true, title: true, caseNumber: true, status: true } }),
      prisma.investigation.findMany({ select: { id: true, title: true, target: true, status: true, caseId: true } }),
      prisma.evidence.findMany({ select: { id: true, name: true, caseId: true, status: true } }),
      prisma.entity.findMany({ select: { id: true, name: true, type: true } }),
      prisma.finding.findMany({
        select: { id: true, investigationId: true, evidenceId: true },
        where: { evidenceId: { not: null } },
      }),
      prisma.entityRelation.findMany({ select: { fromEntityId: true, toEntityId: true, relationType: true, investigationId: true } }),
      prisma.caseAssignment.findMany({ select: { caseId: true, userId: true, role: true } }),
      prisma.agentAssignment.findMany({ select: { caseId: true, agentId: true } }),
    ]);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const u of users) {
    nodes.push({ id: `user:${u.id}`, kind: "user", label: u.name, meta: { role: u.role } });
  }
  for (const a of agents) {
    nodes.push({ id: `agent:${a.id}`, kind: "agent", label: a.name, meta: { type: a.type, status: a.status } });
  }
  for (const c of cases) {
    nodes.push({ id: `case:${c.id}`, kind: "case", label: `${c.caseNumber} · ${c.title}`, meta: { status: c.status } });
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
}
