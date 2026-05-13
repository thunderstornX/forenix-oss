"use client";

import { Activity, GitMerge, Lock } from "lucide-react";

import { useUI, NAV, type ViewType } from "@/lib/store";
import { useHealth } from "@/lib/hooks";

function viewLabel(v: ViewType): string {
  return NAV.find((n) => n.id === v)?.label ?? v;
}

export function Topbar() {
  const activeView = useUI((s) => s.activeView);
  const { data: health } = useHealth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-semibold text-[var(--foreground)]">{viewLabel(activeView)}</h1>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
          forenix-oss
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[var(--foreground-muted)]">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
          adapter <span className="font-mono text-[var(--foreground)]">{health?.adapter ?? "—"}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <GitMerge className="h-3.5 w-3.5 text-[var(--forensic)]" />
          v{health?.version ?? "0.1.0"}
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-[var(--foreground-muted)]" />
          {health?.status === "ok" ? "online" : "starting"}
        </span>
      </div>
    </header>
  );
}
