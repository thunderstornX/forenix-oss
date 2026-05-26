/**
 * PATCH /api/agent-tasks/[id]
 *
 * Cancel a running agent task or queue a rerun.
 *
 * Multi-tenant scope: AgentTask hangs off Agent (deployment-global),
 * not off Case or Investigation. The current schema therefore cannot
 * enforce per-tenant ownership. Any signed-in investigator can
 * cancel any task. A schema split between global agent registry and
 * per-tenant agent execution is tracked as v0.6+ work.
 */
import { z } from "zod";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

const PatchBody = z.object({
  action: z.enum(["cancel", "rerun"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    const body = PatchBody.parse(await request.json());

    const task = await prisma.agentTask.findUnique({ where: { id } });
    if (!task) return Response.json({ error: "not_found" }, { status: 404 });

    if (body.action === "cancel") {
      const updated = await prisma.agentTask.update({
        where: { id },
        data: {
          status: "failed",
          error: "cancelled by analyst",
          completedAt: new Date(),
        },
      });
      await appendAudit({
        action: "agent_task_cancelled",
        entity: "AgentTask",
        entityId: id,
        userId: actor.userId,
        details: { taskType: task.type },
      });
      return Response.json({ data: updated });
    }

    // rerun: spawn a fresh task row that points at the same agent +
    // type, status pending. The actual execution loop (background
    // scheduler) will pick it up; until that ships in a later
    // phase, this just enqueues the row.
    const fresh = await prisma.agentTask.create({
      data: {
        agentId: task.agentId,
        type: task.type,
        status: "pending",
        input: task.input,
      },
    });
    await appendAudit({
      action: "agent_task_rerun_queued",
      entity: "AgentTask",
      entityId: fresh.id,
      userId: actor.userId,
      details: { originalTaskId: id, taskType: task.type },
    });
    return Response.json({ data: fresh }, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
