/**
 * POST /api/investigations/init
 *
 * One-shot investigation bootstrap. The `git add .` of forenix:
 * give it a target + a short objective and it creates an
 * Investigation row with sensible defaults, an audit entry, and
 * returns the URLs the operator needs to pick it up in the UI or
 * fire the pipeline against it.
 *
 * Deliberately does NOT auto-trigger the pipeline run — that's the
 * "commit" step, and the operator may want to inspect the
 * generated row, configure agent groups, or batch several inits
 * before kicking the runner. (The companion `scripts/init.ts` CLI
 * does the same thing from a shell.)
 *
 * Auto-fills:
 *   - title:    derived from target if not provided
 *   - status:   "draft" (so it appears in the dashboard but doesn't
 *               imply a running pipeline)
 *   - priority: "medium"
 *   - createdBy: actor's name or email
 *   - pipelineConfig: a sensible default agent-group selection
 *                     based on targetType (identity + infra for
 *                     domain; identity + social for person; ...).
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

const Body = z.object({
  target: z.string().min(1).max(500),
  targetType: z.enum([
    "domain",
    "person",
    "organization",
    "ip",
    "username",
    "phone",
    "image",
    "compound",
  ]),
  objective: z.string().min(1).max(2_000),
  title: z.string().min(3).max(200).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  /** Optional team owner. If omitted, the investigation is global (NULL teamId). */
  teamId: z.string().optional(),
});

// Pick a sensible default set of agent groups for each target type.
// The operator can edit pipelineConfig later if these don't match.
function defaultAgentGroups(targetType: string): string[] {
  switch (targetType) {
    case "domain":       return ["identity", "infrastructure"];
    case "ip":           return ["infrastructure"];
    case "person":       return ["identity", "social", "geo"];
    case "organization": return ["identity", "infrastructure", "financial"];
    case "username":     return ["identity", "social"];
    case "phone":        return ["identity"];
    case "image":        return ["identity", "geo"];
    case "compound":     return ["identity", "infrastructure", "social", "relationships"];
    default:             return ["identity"];
  }
}

// "vercel.com" → "Investigation: vercel.com"
// "Ali Bhutto" → "Investigation: Ali Bhutto"
function autoTitle(target: string): string {
  const clean = target.length > 60 ? target.slice(0, 57) + "..." : target;
  return `Investigation: ${clean}`;
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession();
    const body = Body.parse(await request.json());

    const groups = defaultAgentGroups(body.targetType);
    const title  = body.title  ?? autoTitle(body.target);

    const inv = await prisma.investigation.create({
      data: {
        title,
        target:        body.target,
        targetType:    body.targetType,
        objective:     body.objective,
        priority:      body.priority ?? "medium",
        status:        "draft",
        pipelineConfig: JSON.stringify(groups),
        createdBy:     actor.name ?? actor.email ?? "operator",
        teamId:        body.teamId ?? null,
      },
      select: {
        id: true,
        title: true,
        target: true,
        targetType: true,
        priority: true,
        status: true,
        createdAt: true,
      },
    });

    await appendAudit({
      action: "investigation_init",
      entity: "Investigation",
      entityId: inv.id,
      userId: actor.userId,
      details: {
        target: inv.target,
        targetType: inv.targetType,
        agentGroups: groups,
      },
    });

    // Build absolute URLs for the response so operators can click
    // through directly (especially handy from the CLI script).
    const origin = new URL(request.url).origin;

    return Response.json({
      data: {
        investigation: inv,
        agentGroups: groups,
        urls: {
          dashboard: `${origin}/app?view=investigations&inv=${inv.id}`,
          runPipeline: `${origin}/api/pipeline/run/${inv.id}`,
        },
        nextStep:
          "Run the pipeline: POST to runPipeline (no body needed — uses the agentGroups stored on the investigation).",
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: "invalid_body", details: err.issues },
        { status: 400 },
      );
    }
    return httpErrorResponse(err);
  }
}
