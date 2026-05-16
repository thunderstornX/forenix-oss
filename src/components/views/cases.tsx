"use client";

import { useState } from "react";
import { Plus, Folders, Loader2, GitBranch, Archive } from "lucide-react";
import { toast } from "sonner";

import { FilterInput, matchesQuery } from "@/components/filter-input";
import { useCases, useCreateCase } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime } from "@/lib/utils";

import { CaseDetail } from "./case-detail";
import { ViewShell } from "./view-shell";

export function CasesView() {
  const list = useCases();
  const create = useCreateCase();
  const activeId = useUI((s) => s.activeCaseId);
  const setActive = useUI((s) => s.setActiveCase);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filter, setFilter] = useState("");

  if (activeId) {
    return <CaseDetail caseId={activeId} />;
  }

  const items = (list.data?.data ?? []).filter((c) =>
    matchesQuery(filter, c.title, c.caseNumber, c.status, c.priority),
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ title, description, priority });
      toast.success("Case opened");
      setOpen(false);
      setTitle(""); setDescription("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <ViewShell
      title="Cases"
      subtitle="Forensic cases — every evidence change recorded against the hash-chained audit log."
      actions={
        <>
          <FilterInput value={filter} onChange={setFilter} placeholder="Filter…" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--forensic)] hover:forensic-glow"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </>
      }
    >
      {open && (
        <form onSubmit={submit} className="glass-strong grid grid-cols-1 gap-3 rounded-lg p-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--forensic)]"
              placeholder="Operation …"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Description</span>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full resize-none rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--forensic)]"
              placeholder="What is this case?"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--forensic)]"
            >
              {["low", "medium", "high", "critical"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex items-center gap-1.5 rounded bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--forensic)] forensic-glow disabled:opacity-60"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((c) => (
          <article
            key={c.id}
            onClick={() => setActive(c.id)}
            className="glass cursor-pointer rounded-lg p-4 transition-colors hover:border-[var(--forensic)] hover:bg-[var(--background-elev)]"
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  <Folders className="h-3.5 w-3.5 text-[var(--forensic)]" />
                  <span className="font-mono">{c.caseNumber}</span>
                </div>
                <h3 className="mt-1 truncate text-[14px] font-medium text-[var(--foreground)]">{c.title}</h3>
              </div>
              <span className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                c.status === "open" ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
              )}>{c.status}</span>
            </header>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--foreground-muted)]">
              <span className="flex items-center gap-1">
                <Archive className="h-3 w-3" /> {c._count.evidence} evidence
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" /> {c._count.branches} branches
              </span>
              <span>{c._count.investigations} linked inv</span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--background-elev-2)]">
                <div
                  className="h-full bg-[var(--forensic)]"
                  style={{ width: `${Math.min(100, Math.max(0, c.progress))}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--foreground-muted)]">
                <span>{c.progress}% complete</span>
                <span>{relTime(c.updatedAt)}</span>
              </div>
            </div>
          </article>
        ))}
        {items.length === 0 && !list.isLoading && (
          <div className="glass col-span-full rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            No cases yet — use <span className="font-mono">New</span> above or seed the database.
          </div>
        )}
      </div>
    </ViewShell>
  );
}
