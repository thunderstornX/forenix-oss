"use client";

import { useState } from "react";
import { Plus, Telescope, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FilterInput, matchesQuery } from "@/components/filter-input";
import { useCreateInvestigation, useInvestigations } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime } from "@/lib/utils";

import { InvestigationDetail } from "./investigation-detail";
import { ViewShell } from "./view-shell";

export function InvestigationsView() {
  const list = useInvestigations();
  const create = useCreateInvestigation();
  const activeId = useUI((s) => s.activeInvestigationId);
  const setActive = useUI((s) => s.setActiveInvestigation);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [targetType, setTargetType] = useState("domain");
  const [objective, setObjective] = useState("");
  const [filter, setFilter] = useState("");

  if (activeId) {
    return <InvestigationDetail investigationId={activeId} />;
  }

  const items = (list.data?.data ?? []).filter((i) =>
    matchesQuery(filter, i.title, i.target, i.targetType, i.status, i.priority),
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ title, target, targetType, objective });
      toast.success("Investigation created");
      setOpen(false);
      setTitle(""); setTarget(""); setObjective("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <ViewShell
      title="Investigations"
      subtitle="Active OSINT investigations. Promote findings to a forensic case once the pipeline completes."
      actions={
        <>
          <FilterInput value={filter} onChange={setFilter} placeholder="Filter…" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-strong)] hover:forensic-glow"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </>
      }
    >
      {open && (
        <form
          onSubmit={submit}
          className="glass-strong rounded-lg p-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
              placeholder="INV-2025-021 — …"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Target</span>
            <input
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-[var(--accent)]"
              placeholder="example.com"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Target type</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
            >
              {["domain", "person", "organization", "ip", "username", "phone"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Objective</span>
            <textarea
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
              placeholder="What are we trying to find out?"
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex items-center gap-1.5 rounded bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-strong)] forensic-glow disabled:opacity-60"
            >
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}

      <div className="glass overflow-hidden rounded-lg">
        <table className="w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--background-elev)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Target</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Findings</th>
              <th className="px-4 py-2.5 font-medium">Bridge</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[var(--foreground)]">
            {items.map((i) => (
              <tr
                key={i.id}
                onClick={() => setActive(i.id)}
                className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background-elev)]"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Telescope className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span className="truncate">{i.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--foreground-muted)]">{i.target}</td>
                <td className="px-4 py-2.5"><StatusPill status={i.status} /></td>
                <td className="px-4 py-2.5">{i._count.findings}</td>
                <td className="px-4 py-2.5">
                  {i.caseId ? (
                    <span className="rounded bg-[var(--background-elev-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--forensic)]">
                      → case
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--foreground-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-[var(--foreground-muted)]">{relTime(i.updatedAt)}</td>
              </tr>
            ))}
            {items.length === 0 && !list.isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[12px] text-[var(--foreground-muted)]">
                  Nothing here yet. Use <span className="font-mono">New</span> above to create one,
                  or run <span className="font-mono">bun run db:seed</span>.
                </td>
              </tr>
            )}
            {list.isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[12px] text-[var(--foreground-muted)]">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "complete"
      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : status === "running" || status === "in_progress"
      ? "bg-[rgba(245,158,11,0.12)] text-[var(--warn)]"
      : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", tone)}>{status}</span>
  );
}
