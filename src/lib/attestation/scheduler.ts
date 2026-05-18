/**
 * Cron-triggered attestation scheduler.
 *
 * Same shape as src/lib/monitor-scheduler/scheduler.ts -  a single
 * tick function that's invoked by either Vercel Cron, GitHub
 * Actions, or the Droplet's systemd timer (POSTing the matching
 * /api/internal/attest-tick endpoint). For each `AttestationSchedule`
 * row whose `enabled=true` AND `nextRunAt <= now + grace`, we fire
 * `runAttestation()` with that backend, persist the result, and
 * advance `nextRunAt`.
 *
 * What this gains over the manual "Attest now" button:
 *   - Closes the strongest gap in the chain-of-custody story:
 *     "did someone remember to attest?" becomes "the chain
 *     witnesses itself on a schedule, audited like everything else."
 *   - The Attestation row + the appended audit-log row both still
 *     happen via the same runAttestation() service used by the
 *     manual route, so there's exactly one code path that produces
 *     an attestation event.
 *   - A failed run still advances nextRunAt (otherwise one transient
 *     network blip silently disables the schedule).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { computeNextRun, isDue, parseCadence } from "@/lib/monitor-scheduler/cadence";

import { runAttestation } from "./service";

export interface AttestTickResult {
  considered: number;
  fired: number;
  succeeded: number;
  failed: number;
  perSchedule: Array<{
    scheduleId: string;
    backend: string;
    status: "succeeded" | "failed" | "skipped";
    attestationId?: string;
    durationMs: number;
    error?: string;
  }>;
}

const GRACE_MS = 60 * 1000;

export async function runAttestTick(opts?: {
  limit?: number;
  now?: Date;
}): Promise<AttestTickResult> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 10;

  const schedules = await prisma.attestationSchedule.findMany({
    where: {
      enabled: true,
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: new Date(now.getTime() + GRACE_MS) } },
      ],
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const result: AttestTickResult = {
    considered: schedules.length,
    fired: 0,
    succeeded: 0,
    failed: 0,
    perSchedule: [],
  };

  for (const s of schedules) {
    if (!isDue(s.nextRunAt, now, GRACE_MS)) {
      result.perSchedule.push({
        scheduleId: s.id,
        backend: s.backend,
        status: "skipped",
        durationMs: 0,
      });
      continue;
    }
    result.fired += 1;
    const started = Date.now();
    let attestationId: string | undefined;
    let runError: string | undefined;
    try {
      const att = await runAttestation({
        backend: s.backend,
        actorId: null, // system-initiated
      });
      attestationId = att.id;
      if (att.status === "failed") {
        // runAttestation() does NOT throw on backend failure  -  it
        // persists the failed row and returns it. We still treat it
        // as failure for scheduling purposes so the lastError column
        // surfaces meaningfully.
        runError = att.error ?? "backend returned failed";
        result.failed += 1;
      } else {
        result.succeeded += 1;
      }
    } catch (e) {
      runError = (e as Error).message;
      result.failed += 1;
    }

    // Advance the schedule regardless of success/failure.
    const nextRunAt = computeNextRun(s.cadence);
    await prisma.attestationSchedule.update({
      where: { id: s.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
        lastError: runError ?? null,
      },
    });

    result.perSchedule.push({
      scheduleId: s.id,
      backend: s.backend,
      status: runError ? "failed" : "succeeded",
      attestationId,
      durationMs: Date.now() - started,
      error: runError,
    });

    // No-op  -  parseCadence is idempotent + cheap; only here so the
    // canonical form gets re-asserted in case an operator edited the
    // row to a freshly-introduced syntax we now accept.
    parseCadence(s.cadence);
  }

  return result;
}
