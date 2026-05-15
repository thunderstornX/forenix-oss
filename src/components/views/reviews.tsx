"use client";

import { Diff, Folders, MessageSquare, GitBranch } from "lucide-react";

import { useReviews } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

const STATUS_TONE: Record<string, string> = {
  open: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  merged: "bg-[var(--background-elev-2)] text-[var(--forensic)]",
  closed: "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
};

export function ReviewsView() {
  const r = useReviews();
  const setCase = useUI((s) => s.setActiveCase);
  const setView = useUI((s) => s.setView);
  const rows = r.data?.data ?? [];

  return (
    <ViewShell
      title="Reviews"
      subtitle="Merge requests across all cases. Approving an MR fast-forwards its branch onto the case's main."
      actions={<span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} merge requests</span>}
    >
      <div className="space-y-2">
        {rows.map((mr) => (
          <article key={mr.id} className="glass rounded-lg p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  <Diff className="h-3 w-3 text-[var(--forensic)]" />
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    <span style={{ color: mr.branch.color }}>{mr.branch.name}</span>
                  </span>
                </div>
                <h3 className="mt-0.5 truncate text-[14px] font-medium text-[var(--foreground)]">{mr.title}</h3>
                {mr.description && (
                  <p className="mt-1 text-[12px] text-[var(--foreground-muted)]">{mr.description}</p>
                )}
              </div>
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", STATUS_TONE[mr.status] ?? "")}>
                {mr.status}
              </span>
            </header>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[var(--foreground-muted)]">
              <button
                type="button"
                onClick={() => { setCase(mr.case.id); setView("cases"); }}
                className="flex items-center gap-1 text-[var(--forensic)] hover:underline"
              >
                <Folders className="h-3 w-3" />
                {mr.case.caseNumber}
              </button>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {mr._count.comments} comments
              </span>
              <span>reviewer: {mr.reviewer?.name ?? "unassigned"}</span>
              <span>{relTime(mr.createdAt)}</span>
            </div>
          </article>
        ))}
        {rows.length === 0 && !r.isLoading && (
          <div className="glass rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            No merge requests yet.
          </div>
        )}
      </div>
    </ViewShell>
  );
}
