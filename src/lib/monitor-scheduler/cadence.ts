/**
 * Cadence parsing  -  the language a Monitor row's `cadence` column
 * speaks, used by both the scheduler (to compute nextRunAt) and the
 * UI (to render a human label + offer a picker).
 *
 * Two syntaxes accepted, in order of preference:
 *
 *   1. Named shortcuts:    "hourly" | "daily" | "weekly" | "monthly"
 *   2. Compact every:N(m|h|d):
 *                          "every:5m"  -> every 5 minutes
 *                          "every:6h"  -> every 6 hours
 *                          "every:7d"  -> every 7 days
 *
 * Pure function, dependency-free; safe to import from the seed
 * script, the scheduler, the UI, and bun:test alike.
 */

const NAMED_MS: Record<string, number> = {
  hourly:  60 * 60 * 1000,
  daily:   24 * 60 * 60 * 1000,
  weekly:  7  * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000, // calendar months are messy; 30d is what we mean for cadence purposes
};

const UNIT_MS: Record<"m" | "h" | "d", number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const MIN_INTERVAL_MS = 60 * 1000;        // 1 minute floor; tighter and the tick endpoint can't catch up
const MAX_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000; // 90 day ceiling; longer and it's effectively manual

export interface ParsedCadence {
  /** Canonical form: always the every:Nu syntax once normalised. */
  canonical: string;
  /** Interval expressed in milliseconds. */
  intervalMs: number;
  /** Short human label suitable for the UI ("every 6h", "weekly"). */
  label: string;
}

export class CadenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CadenceError";
  }
}

export function parseCadence(input: string): ParsedCadence {
  const raw = input.trim().toLowerCase();
  if (!raw) throw new CadenceError("cadence is required");

  // Named shortcut path.
  if (raw in NAMED_MS) {
    const ms = NAMED_MS[raw]!;
    return {
      canonical: namedToEvery(raw),
      intervalMs: ms,
      label: raw,
    };
  }

  // every:Nu path.
  const m = /^every:(\d+)([mhd])$/.exec(raw);
  if (!m) {
    throw new CadenceError(
      `unrecognised cadence "${input}". Expected one of hourly|daily|weekly|monthly or every:N(m|h|d).`,
    );
  }
  const n = Number(m[1]);
  const unit = m[2] as "m" | "h" | "d";
  if (!Number.isInteger(n) || n <= 0) {
    throw new CadenceError("cadence interval must be a positive integer");
  }
  const ms = n * UNIT_MS[unit];
  if (ms < MIN_INTERVAL_MS) {
    throw new CadenceError(`cadence cannot be tighter than 1 minute (got ${input})`);
  }
  if (ms > MAX_INTERVAL_MS) {
    throw new CadenceError(`cadence cannot be longer than 90 days (got ${input})`);
  }
  return {
    canonical: `every:${n}${unit}`,
    intervalMs: ms,
    label: `every ${n}${unit}`,
  };
}

function namedToEvery(named: string): string {
  switch (named) {
    case "hourly":  return "every:1h";
    case "daily":   return "every:1d";
    case "weekly":  return "every:7d";
    case "monthly": return "every:30d";
    default:        return named;
  }
}

/**
 * Compute the next run timestamp from a cadence + an anchor.
 * `from` defaults to `now` so callers don't need to pass it; tests
 * usually want to pin it.
 */
export function computeNextRun(
  cadence: string,
  from: Date = new Date(),
): Date {
  const { intervalMs } = parseCadence(cadence);
  return new Date(from.getTime() + intervalMs);
}

/**
 * Predicate the scheduler uses to decide which rows to fire.
 * Includes a small grace window so a row whose nextRunAt is in the
 * past by less than `graceMs` still fires (catches up missed ticks
 * after a deploy or cron blip).
 */
export function isDue(
  nextRunAt: Date | null,
  now: Date = new Date(),
  graceMs: number = 0,
): boolean {
  if (!nextRunAt) return true; // never run -> always due
  return nextRunAt.getTime() - graceMs <= now.getTime();
}
