"use client";

import { Radar, Telescope } from "lucide-react";

import { useMonitors } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

export function MonitorsView() {
  const m = useMonitors();
  const setInv = useUI((s) => s.setActiveInvestigation);
  const setView = useUI((s) => s.setView);
  const rows = m.data?.data ?? [];

  return (
    <ViewShell
      title="Monitors"
      subtitle="Cadenced re-runs of each investigation. Every run records delta findings the next sweep should chase."
      actions={<span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} active</span>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <article key={r.id} className="glass rounded-lg p-4">
            <header className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  <Radar className="h-3 w-3 text-[var(--accent)]" />
                  {r.cadence}
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--foreground)]">
                  <span className="font-mono">{r.target}</span> | {r.targetType}
                </div>
              </div>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                  r.status === "active"
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
                )}
              >
                {r.status}
              </span>
            </header>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Last run</div>
                <div className="mt-0.5 text-[var(--foreground)]">{r.lastRunAt ? relTime(r.lastRunAt) : " - "}</div>
              </div>
              <div className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Next run</div>
                <div className="mt-0.5 text-[var(--foreground)]">{r.nextRunAt ? relTime(r.nextRunAt) : " - "}</div>
              </div>
            </div>

            {r.runs.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Recent runs</div>
                <ul className="mt-1 space-y-1">
                  {r.runs.map((run) => (
                    <li key={run.id} className="flex items-center justify-between rounded bg-[var(--background-elev-2)] px-2 py-1 text-[11px]">
                      <span>{run.status} | {run.findingsCount} findings</span>
                      <span className="text-[10px] text-[var(--foreground-muted)]">{relTime(run.startedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.investigation && (
              <button
                type="button"
                onClick={() => { setInv(r.investigation!.id); setView("investigations"); }}
                className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--accent)] hover:underline"
              >
                <Telescope className="h-3 w-3" />
                {r.investigation.title}
              </button>
            )}
          </article>
        ))}
        {rows.length === 0 && !m.isLoading && (
          <div className="glass col-span-full rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            No monitors yet.
          </div>
        )}
      </div>
    </ViewShell>
  );
}
