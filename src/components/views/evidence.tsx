"use client";

import { Archive, Folders, Lock } from "lucide-react";

import { useState } from "react";

import { FilterInput, matchesQuery } from "@/components/filter-input";
import { useEvidence } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

const KB = 1024, MB = KB * 1024, GB = MB * 1024;

function formatSize(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return " - ";
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  if (n < GB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(1)} GB`;
}

export function EvidenceView() {
  const list = useEvidence();
  const setActiveCase = useUI((s) => s.setActiveCase);
  const setView = useUI((s) => s.setView);
  const [filter, setFilter] = useState("");

  const rows = (list.data?.data ?? []).filter((e) =>
    matchesQuery(filter, e.name, e.type, e.mimeType ?? "", e.status, e.tags, e.case.caseNumber),
  );

  return (
    <ViewShell
      title="Evidence"
      subtitle="Every piece of evidence across every open case. Each row links back to its parent case and its hash-chained commits."
      actions={
        <>
          <FilterInput value={filter} onChange={setFilter} placeholder="Filter..." />
          <span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} items</span>
        </>
      }
    >
      <div className="glass overflow-hidden rounded-lg">
        <table className="w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--background-elev)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Hash</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Case</th>
              <th className="px-3 py-2 font-medium">Commits</th>
              <th className="px-3 py-2 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background-elev)]">
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--forensic)]" />
                    <div className="min-w-0">
                      <div className="truncate text-[var(--foreground)]">{e.name}</div>
                      {e.description && (
                        <div className="truncate text-[10px] text-[var(--foreground-muted)]">{e.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-[var(--foreground-muted)]">
                  {e.type}
                  {e.mimeType && (
                    <div className="text-[10px]">{e.mimeType}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-[var(--foreground)]">{formatSize(e.size)}</td>
                <td className="px-3 py-2 align-top">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-[var(--foreground-muted)]" />
                    <span className="font-mono text-[11px]">{shortHash(e.hash)}</span>
                  </span>
                  <div className="text-[10px] text-[var(--foreground-muted)]">{e.hashAlgo}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      e.status === "verified"
                        ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : e.status === "sealed"
                        ? "bg-[var(--background-elev-2)] text-[var(--forensic)]"
                        : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
                    )}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => { setActiveCase(e.case.id); setView("cases"); }}
                    className="flex items-center gap-1 text-[var(--forensic)] hover:underline"
                  >
                    <Folders className="h-3 w-3" />
                    <span className="font-mono text-[11px]">{e.case.caseNumber}</span>
                  </button>
                </td>
                <td className="px-3 py-2 align-top text-[var(--foreground)]">{e._count.commits}</td>
                <td className="px-3 py-2 align-top text-[11px] text-[var(--foreground-muted)]">{relTime(e.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && !list.isLoading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[12px] text-[var(--foreground-muted)]">
                  No evidence yet. Open a case, or promote findings from an investigation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}
