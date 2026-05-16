"use client";

import { Diff, Folders, MessageSquare, GitBranch, GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useMergeReview, useReviews } from "@/lib/hooks";
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
  const merge = useMergeReview();
  const setCase = useUI((s) => s.setActiveCase);
  const setView = useUI((s) => s.setView);
  const rows = r.data?.data ?? [];

  async function onMerge(id: string) {
    try {
      const res = await merge.mutateAsync(id) as { data: { gitOid: string; fastForward: boolean } };
      toast.success(
        `Merged ${res.data.fastForward ? "(fast-forward)" : "(3-way)"} · ${res.data.gitOid.slice(0, 8)}`,
      );
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("merge_conflict")) {
        toast.error("Merge conflict — see audit log for affected files.");
      } else {
        toast.error(msg);
      }
    }
  }

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
              {mr.status === "open" && (
                <button
                  type="button"
                  onClick={() => onMerge(mr.id)}
                  disabled={merge.isPending}
                  className="ml-auto flex items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--forensic)] hover:forensic-glow disabled:opacity-60"
                >
                  {merge.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
                  merge
                </button>
              )}
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
