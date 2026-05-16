/**
 * POST /api/pipeline/run/[id]
 *
 * Drives the AI adapter end-to-end for one investigation:
 *   1. analyzePipeline()    for each requested agent group
 *   2. extractEntities()    over the combined findings
 *   3. generateReport()     synthesises the deliverable
 *
 * Everything is persisted (Finding, Entity, EntityRelation, Report)
 * and every step appends an audit row to the hash chain.
 *
 * The adapter is selected entirely by the env (`AI_ADAPTER`), so the
 * same route works in mock, ollama, glm, or claude mode.
 */
import { z } from "zod";

import { getAdapter } from "@/lib/ai/adapter";

// Vercel function ceiling — extend to the Hobby/Pro max so the
// pipeline doesn't get killed mid-run on a slow hosted LLM.
export const maxDuration = 60;
import type {
  AgentGroup,
  Finding as AdapterFinding,
  PipelineAnalysis,
  SearchResult,
} from "@/lib/ai/types";
import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const Body = z.object({
  agentGroups: z
    .array(
      z.enum([
        "identity",
        "infrastructure",
        "financial",
        "social",
        "geo",
        "relationships",
        "media",
      ]),
    )
    .optional(),
  adapter: z.enum(["mock", "ollama", "glm", "claude", "openrouter", "nvidia", "grok", "groq"]).optional(),
});

// Fabricate a small handful of search hits so the mock adapter has
// something to chew on. In Phase 3.1 we'll swap this for a real
// search-API integration (also adapter-shaped).
function syntheticSearchResults(target: string, group: AgentGroup): SearchResult[] {
  return [
    {
      title: `${group} signal — ${target}`,
      url: `https://search.example.local/q=${encodeURIComponent(target)}&g=${group}`,
      snippet: `Synthetic candidate snippet for ${target} under the ${group} agent group.`,
      source: "synthetic",
    },
    {
      title: `Cross-reference for ${target}`,
      url: `https://archive.example.local/${group}/${encodeURIComponent(target)}`,
      snippet: `Archive snapshot mentioning ${target} in ${group} context.`,
      source: "archive",
    },
  ];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inv = await prisma.investigation.findUnique({ where: { id } });
  if (!inv) {
    return Response.json({ error: "investigation_not_found" }, { status: 404 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    const raw = await request.text();
    const body = raw.trim() === "" ? {} : JSON.parse(raw);
    parsed = Body.parse(body);
  } catch (err) {
    return Response.json(
      { error: "invalid_body", details: (err as Error).message },
      { status: 400 },
    );
  }

  // Pipeline config takes precedence over caller body; falls back to
  // a sensible default if neither is set.
  const configured = (() => {
    try {
      const v = JSON.parse(inv.pipelineConfig || "[]");
      return Array.isArray(v) ? (v as AgentGroup[]) : [];
    } catch {
      return [];
    }
  })();
  const groups: AgentGroup[] =
    parsed.agentGroups ??
    (configured.length > 0
      ? configured
      : ["identity", "infrastructure", "social"]);

  const adapter = parsed.adapter ? getAdapter(parsed.adapter) : getAdapter();

  await prisma.investigation.update({
    where: { id },
    data: { status: "running" },
  });
  await appendAudit({
    action: "pipeline_started",
    entity: "Investigation",
    entityId: id,
    investigationId: id,
    details: { adapter: adapter.name, groups },
  });

  // ── Step 1: parallel agent-group runs ──────────────────────────
  const analyses: PipelineAnalysis[] = await Promise.all(
    groups.map((g) => adapter.analyzePipeline(inv.target, g, syntheticSearchResults(inv.target, g))),
  );

  const allFindings: AdapterFinding[] = [];
  let writtenFindings = 0;
  for (const a of analyses) {
    for (const f of a.findings) {
      const created = await prisma.finding.create({
        data: {
          investigationId: id,
          category: f.category,
          title: f.title,
          description: f.description,
          confidence: f.confidence,
          sourceType: f.sourceType,
          sourceName: f.sourceName,
          agentGroup: f.agentGroup,
          reasoningTrace: f.reasoningTrace ?? "",
          priority: f.priority,
          evidenceRefs: JSON.stringify(f.evidenceRefs ?? []),
          rawData: JSON.stringify(f.rawData ?? {}),
        },
      });
      allFindings.push({ ...f, id: created.id });
      writtenFindings++;
    }
    await appendAudit({
      action: `agent_${a.agentGroup}_completed`,
      entity: "Investigation",
      entityId: id,
      investigationId: id,
      details: { findingsAdded: a.findings.length, confidence: a.confidence },
    });
  }

  // ── Step 2: entity extraction ─────────────────────────────────
  const extraction = await adapter.extractEntities(allFindings);
  const entityByName = new Map<string, string>();
  for (const e of extraction.entities) {
    const existing = await prisma.entity.findFirst({
      where: { name: e.name, type: e.type },
      select: { id: true },
    });
    if (existing) {
      entityByName.set(e.name, existing.id);
      continue;
    }
    const created = await prisma.entity.create({
      data: {
        name: e.name,
        type: e.type,
        properties: JSON.stringify(e.properties),
        source: inv.title,
        verified: e.confidence === "confirmed",
      },
    });
    entityByName.set(e.name, created.id);
  }
  let writtenRelations = 0;
  for (const r of extraction.relations) {
    const from = entityByName.get(r.from);
    const to = entityByName.get(r.to);
    if (!from || !to) continue;
    await prisma.entityRelation.create({
      data: {
        fromEntityId: from,
        toEntityId: to,
        relationType: r.relationType,
        confidence: r.confidence,
        investigationId: id,
      },
    });
    writtenRelations++;
  }
  await appendAudit({
    action: "entities_extracted",
    entity: "Investigation",
    entityId: id,
    investigationId: id,
    details: {
      entities: extraction.entities.length,
      relations: writtenRelations,
    },
  });

  // ── Step 3: report ────────────────────────────────────────────
  const reportMd = await adapter.generateReport(
    {
      id: inv.id,
      title: inv.title,
      target: inv.target,
      objective: inv.objective,
      status: "complete",
    },
    allFindings,
  );
  const report = await prisma.report.create({
    data: {
      title: `${inv.title} — Pipeline Report`,
      source: "investigation",
      investigationId: id,
      type: "summary",
      status: "draft",
      content: reportMd,
      findingCount: writtenFindings,
      generatedBy: adapter.name,
    },
  });
  await appendAudit({
    action: "report_generated",
    entity: "Report",
    entityId: report.id,
    investigationId: id,
    details: { length: reportMd.length, adapter: adapter.name },
  });

  await prisma.investigation.update({
    where: { id },
    data: { status: "complete" },
  });
  await appendAudit({
    action: "pipeline_completed",
    entity: "Investigation",
    entityId: id,
    investigationId: id,
    details: { findings: writtenFindings, entities: extraction.entities.length, relations: writtenRelations, reportId: report.id },
  });

  return Response.json(
    {
      data: {
        investigationId: id,
        adapter: adapter.name,
        agentGroups: groups,
        findings: writtenFindings,
        entities: extraction.entities.length,
        relations: writtenRelations,
        report: { id: report.id, title: report.title },
      },
    },
    { status: 201 },
  );
}
