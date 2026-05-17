"use client";

import { useState } from "react";
import { GitCommit, Eye, Telescope, Folders } from "lucide-react";

import { FilterInput, matchesQuery } from "@/components/filter-input";
import { useAudit } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

export function AuditView() {
  const audit = useAudit();
  const setView = useUI((s) => s.setView);
  const setInv = useUI((s) => s.setActiveInvestigation);
  const setCase = useUI((s) => s.setActiveCase);
  const [filter, setFilter] = useState("");
  const rows = (audit.data?.data ?? []).filter((r) =>
    matchesQuery(filter, r.action, r.entity, r.entityId ?? "", r.hash ?? ""),
  );

  return (
    <ViewShell
      title="Audit log"
      subtitle="Append-only chain across both workflows. Every write computes sha256(prevHash | action | entity | entityId | iso(t))."
      actions={
        <>
          <FilterInput value={filter} onChange={setFilter} placeholder="action, entity, hash..." />
          <span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} entries</span>
        </>
      }
    >
      <div className="glass overflow-hidden rounded-lg">
        <table className="w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--background-elev)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Hash</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {rows.map((r, idx) => {
              const prev = idx === 0 ? null : rows[idx - 1]!;
              const chainBroken =
                prev !== null && r.prevHash !== prev.hash;
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-[var(--border)] last:border-0",
                    chainBroken
                      ? "bg-[rgba(239,68,68,0.05)]"
                      : "hover:bg-[var(--background-elev)]",
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      <GitCommit className="h-3 w-3 text-[var(--accent)]" />
                      <span className="font-mono text-[11px] text-[var(--foreground)]">{shortHash(r.hash)}</span>
                    </div>
                    {r.prevHash && (
                      <div className="ml-4 mt-0.5 text-[10px] text-[var(--foreground-muted)]">
                        prev: <span className="font-mono">{shortHash(r.prevHash)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">{r.action}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-[var(--foreground)]">{r.entity}</div>
                    {r.entityId && (
                      <div className="font-mono text-[10px] text-[var(--foreground-muted)]">{r.entityId.slice(0, 12)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.investigationId && (
                      <button
                        type="button"
                        onClick={() => { setInv(r.investigationId!); setView("investigations"); }}
                        className="mb-0.5 flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
                      >
                        <Telescope className="h-3 w-3" /> inv
                      </button>
                    )}
                    {r.caseId && (
                      <button
                        type="button"
                        onClick={() => { setCase(r.caseId!); setView("cases"); }}
                        className="flex items-center gap-1 text-[10px] text-[var(--forensic)] hover:underline"
                      >
                        <Folders className="h-3 w-3" /> case
                      </button>
                    )}
                    {!r.investigationId && !r.caseId && (
                      <span className="text-[10px] text-[var(--foreground-muted)]"> - </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-[11px] text-[var(--foreground-muted)]">
                    {relTime(r.createdAt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[12px] text-[var(--foreground-muted)]">
                  <Eye className="mx-auto mb-2 h-4 w-4" />
                  No audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}
