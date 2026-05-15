"use client";

import { ShieldCheck } from "lucide-react";

import { useVerifications } from "@/lib/hooks";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

const VERDICT_TONE: Record<string, string> = {
  confirmed: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  probable: "bg-[rgba(245,158,11,0.12)] text-[var(--warn)]",
  unverified: "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
  disputed: "bg-[rgba(239,68,68,0.12)] text-[var(--danger)]",
  false: "bg-[rgba(239,68,68,0.12)] text-[var(--danger)]",
  pending: "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
};

export function VerificationView() {
  const v = useVerifications();
  const rows = v.data?.data ?? [];

  return (
    <ViewShell
      title="Verification"
      subtitle="Claim-level verdicts with sub-claim breakdown. Every verdict carries a reasoning trace and a chain-of-evidence ID list."
      actions={<span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} claims</span>}
    >
      <div className="space-y-2">
        {rows.map((r) => (
          <article key={r.id} className="glass rounded-lg p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />
                  {r.claimType}
                </div>
                <p className="mt-1 text-[13px] text-[var(--foreground)]">{r.claim}</p>
              </div>
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", VERDICT_TONE[r.verdict] ?? VERDICT_TONE["pending"])}>
                {r.verdict}
              </span>
            </header>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--foreground-muted)]">
              <span>by {r.createdBy}</span>
              <span>{relTime(r.createdAt)}</span>
            </div>
          </article>
        ))}
        {rows.length === 0 && !v.isLoading && (
          <div className="glass rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            No claims yet.
          </div>
        )}
      </div>
    </ViewShell>
  );
}
