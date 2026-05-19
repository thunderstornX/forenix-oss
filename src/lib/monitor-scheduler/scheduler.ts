/**
 * Monitor scheduler — the tick the cron driver calls into.
 *
 * Architecture: one entry point, two drivers.
 *
 *   ┌─────────────────────────┐         ┌──────────────────────────┐
 *   │  DigitalOcean Droplet   │         │  Vercel (serverless)     │
 *   │  systemd timer (every   │         │  Vercel Cron (every      │
 *   │  5min) -> curl tick     │         │  5min) -> POST tick      │
 *   └──────────────┬──────────┘         └────────────┬─────────────┘
 *                  │                                  │
 *                  └──────► POST /api/internal/monitor-tick ◄────┘
 *                                       │
 *                                       ▼
 *                            runMonitorTick()  ◄── this file
 *                                       │
 *                                       ▼
 *                  finds rows where status='active' and isDue(),
 *                  runs each (the runner picks safe HTTP-only tools
 *                  on Vercel, full subprocess registry on a real
 *                  host), persists a MonitorRun, advances nextRunAt.
 *
 * The runner is intentionally a thin wrapper around the existing
 * `web_search` + `crtsh_certificates` HTTP tools rather than the
 * full investigation pipeline — that keeps the scheduler tick
 * cheap (<60s on Vercel) and the integration footprint small.
 * Wiring the full pipeline into a scheduled run is a follow-up
 * once the scheduler infrastructure has settled.
 */
import "server-only";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events/emitter";
import { ALL_TOOLS } from "@/lib/tools/registry";
import type { Tool } from "@/lib/tools/types";

import { computeNextRun, isDue, parseCadence } from "./cadence";

export interface TickResult {
  considered: number;
  fired: number;
  succeeded: number;
  failed: number;
  perMonitor: Array<{
    monitorId: string;
    status: "succeeded" | "failed" | "skipped";
    findings: number;
    durationMs: number;
    error?: string;
  }>;
}

const GRACE_MS = 60 * 1000; // catch monitors whose nextRunAt is within 60s of now

export async function runMonitorTick(opts?: {
  /** Cap how many monitors a single tick processes. Default 25. */
  limit?: number;
  /** Override "now" — tests pin this. */
  now?: Date;
}): Promise<TickResult> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 25;

  // Pull the candidate set: active monitors, ordered so the most
  // overdue go first.
  const candidates = await prisma.monitor.findMany({
    where: {
      status: "active",
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: new Date(now.getTime() + GRACE_MS) } },
      ],
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    include: {
      investigation: { select: { id: true, target: true } },
    },
  });

  const result: TickResult = {
    considered: candidates.length,
    fired: 0,
    succeeded: 0,
    failed: 0,
    perMonitor: [],
  };

  for (const m of candidates) {
    if (!isDue(m.nextRunAt, now, GRACE_MS)) {
      result.perMonitor.push({
        monitorId: m.id,
        status: "skipped",
        findings: 0,
        durationMs: 0,
      });
      continue;
    }
    result.fired += 1;
    const started = Date.now();
    try {
      const { findingsCount } = await runOneMonitor(m);
      result.succeeded += 1;
      result.perMonitor.push({
        monitorId: m.id,
        status: "succeeded",
        findings: findingsCount,
        durationMs: Date.now() - started,
      });
    } catch (e) {
      result.failed += 1;
      result.perMonitor.push({
        monitorId: m.id,
        status: "failed",
        findings: 0,
        durationMs: Date.now() - started,
        error: (e as Error).message,
      });
    }
  }

  return result;
}

interface MonitorWithInv {
  id: string;
  target: string;
  targetType: string;
  cadence: string;
  investigationId: string | null;
  investigation: { id: string; target: string } | null;
}

async function runOneMonitor(m: MonitorWithInv): Promise<{ findingsCount: number }> {
  // Create the MonitorRun row up-front so a crash mid-run leaves a
  // breadcrumb instead of a silent gap.
  const run = await prisma.monitorRun.create({
    data: {
      monitorId: m.id,
      status: "running",
    },
  });

  emit("monitor.run.started", { monitorId: m.id, runId: run.id });

  let findingsCount = 0;

  try {
    // Always-available HTTP tools only — keeps the scheduler tick
    // safe to invoke from Vercel (no subprocess deps) and short
    // enough to finish well inside the function ceiling.
    const target = m.target;
    const tools = pickSafeTools(["web_search", "crtsh_certificates"]);

    const perTool: Array<{ tool: string; ok: boolean; preview: string }> = [];
    for (const tool of tools) {
      try {
        // Each tool decides what arg keys it cares about; both
        // web_search and crtsh accept { target } / { query } / { domain }
        // shapes so we pass all three to be safe.
        const out = await tool.execute({ target, query: target, domain: target });
        const preview = JSON.stringify(out).slice(0, 400);
        perTool.push({ tool: tool.name, ok: true, preview });
        findingsCount += countFindings(out);
      } catch (e) {
        perTool.push({
          tool: tool.name,
          ok: false,
          preview: (e as Error).message.slice(0, 240),
        });
      }
    }
    await prisma.monitorRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        result: JSON.stringify({ perTool, target }),
        findingsCount,
        completedAt: new Date(),
      },
    });
    emit("monitor.run.completed", { monitorId: m.id, runId: run.id, status: "succeeded" });
  } catch (e) {
    await prisma.monitorRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        result: JSON.stringify({ error: (e as Error).message }),
        completedAt: new Date(),
      },
    });
    emit("monitor.run.completed", { monitorId: m.id, runId: run.id, status: "failed" });
    throw e;
  }

  // Advance nextRunAt regardless of result — the next attempt
  // should be scheduled even after a failure, otherwise a single
  // network blip permanently disables a monitor.
  const nextRunAt = computeNextRun(m.cadence);
  await prisma.monitor.update({
    where: { id: m.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt,
    },
  });

  await appendAudit({
    action: "monitor_run",
    entity: "Monitor",
    entityId: m.id,
    investigationId: m.investigationId ?? null,
    details: {
      runId: run.id,
      findings: findingsCount,
      cadence: parseCadence(m.cadence).canonical,
      nextRunAt: nextRunAt.toISOString(),
    },
  });

  return { findingsCount };
}

function pickSafeTools(names: string[]): Tool[] {
  return ALL_TOOLS.filter((t) => names.includes(t.name));
}

// Best-effort: most of our HTTP tools return either an array of
// results or an object with a `results` / `findings` array. We just
// want a count for the MonitorRun row's `findingsCount` column.
function countFindings(out: unknown): number {
  if (Array.isArray(out)) return out.length;
  if (out && typeof out === "object") {
    const o = out as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results.length;
    if (Array.isArray(o.findings)) return o.findings.length;
    if (Array.isArray(o.data)) return o.data.length;
  }
  return 0;
}
