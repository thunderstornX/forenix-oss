"use client";

import { Telescope, Folders, Network, Activity } from "lucide-react";

import { useCases, useInvestigations, useHealth } from "@/lib/hooks";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

export function DashboardView() {
  const investigations = useInvestigations();
  const cases = useCases();
  const health = useHealth();

  const invItems = investigations.data?.data ?? [];
  const caseItems = cases.data?.data ?? [];
  const linked = invItems.filter((i) => i.caseId !== null).length;

  const stats: { label: string; value: string; sub?: string; icon: React.ReactNode; tone?: string }[] = [
    {
      label: "Investigations",
      value: invItems.length.toString(),
      sub: `${linked} linked to a case`,
      icon: <Telescope className="h-4 w-4" />,
      tone: "text-[var(--accent)]",
    },
    {
      label: "Cases",
      value: caseItems.length.toString(),
      sub: `${caseItems.reduce((s, c) => s + c._count.evidence, 0)} evidence items`,
      icon: <Folders className="h-4 w-4" />,
      tone: "text-[var(--forensic)]",
    },
    {
      label: "Active monitors",
      value: invItems.reduce((s, i) => s + i._count.monitors, 0).toString(),
      sub: "weekly + daily cadence",
      icon: <Network className="h-4 w-4" />,
      tone: "text-[var(--accent-strong)]",
    },
    {
      label: "AI adapter",
      value: health.data?.adapter ?? "—",
      sub: health.data?.status === "ok" ? "online" : "starting",
      icon: <Activity className="h-4 w-4" />,
      tone: "text-[var(--accent)]",
    },
  ];

  return (
    <ViewShell
      title="Dashboard"
      subtitle="One pane over both workflows — OSINT investigations and forensic cases."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-lg p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              <span className={cn(s.tone)}>{s.icon}</span>
              {s.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{s.value}</div>
            {s.sub && (
              <div className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">{s.sub}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="glass rounded-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--foreground)]">Recent investigations</h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              {invItems.length}
            </span>
          </div>
          <ul className="space-y-2">
            {invItems.slice(0, 4).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-[var(--foreground)]">{i.title}</div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">
                    target: <span className="font-mono">{i.target}</span> · {i.targetType}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] capitalize text-[var(--accent)]">{i.status}</div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">{relTime(i.updatedAt)}</div>
                </div>
              </li>
            ))}
            {invItems.length === 0 && (
              <li className="rounded border border-dashed border-[var(--border)] p-3 text-center text-[12px] text-[var(--foreground-muted)]">
                no investigations yet — run <span className="font-mono">bun run db:seed</span>.
              </li>
            )}
          </ul>
        </div>

        <div className="glass rounded-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--foreground)]">Open cases</h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              {caseItems.length}
            </span>
          </div>
          <ul className="space-y-2">
            {caseItems.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-[var(--foreground)]">{c.title}</div>
                  <div className="text-[11px] text-[var(--foreground-muted)]">
                    <span className="font-mono">{c.caseNumber}</span> · {c._count.evidence} ev / {c._count.investigations} inv
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] capitalize text-[var(--forensic)]">{c.status}</div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">{c.progress}%</div>
                </div>
              </li>
            ))}
            {caseItems.length === 0 && (
              <li className="rounded border border-dashed border-[var(--border)] p-3 text-center text-[12px] text-[var(--foreground-muted)]">
                no cases yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </ViewShell>
  );
}
