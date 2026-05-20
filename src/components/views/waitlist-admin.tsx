"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useLiveEvents } from "@/hooks/use-live-events";
import {
  useAdminWaitlist,
  useApproveWaitlist,
  useDeclineWaitlist,
  type WaitlistAdminRow,
  type WaitlistApproveResult,
} from "@/lib/hooks";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

type StatusFilter = "pending" | "invited" | "declined" | "all";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "pending",  label: "Pending" },
  { key: "invited",  label: "Invited" },
  { key: "declined", label: "Declined" },
  { key: "all",      label: "All" },
];

export function WaitlistAdminView() {
  const q = useAdminWaitlist();
  const approve = useApproveWaitlist();
  const decline = useDeclineWaitlist();
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [approveResult, setApproveResult] = useState<WaitlistApproveResult | null>(null);

  // Live updates: a new public signup, or an audit append for a
  // waitlist action, refreshes the table.
  const qc = useQueryClient();
  useLiveEvents(["audit.append"], (env) => {
    // env.payload is a union over every topic; the topic filter above
    // limits us to audit.append, but TS doesn't narrow the union
    // automatically when callback subscribes to many topics by name.
    const payload = env.payload as { action?: string };
    if (
      payload.action === "waitlist_signup" ||
      payload.action === "waitlist_approve" ||
      payload.action === "waitlist_decline"
    ) {
      qc.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    }
  });

  const rows = useMemo<WaitlistAdminRow[]>(() => {
    const all = q.data?.data ?? [];
    if (filter === "all") return all;
    return all.filter((r) => r.status === filter);
  }, [q.data, filter]);

  const counts = useMemo(() => {
    const all = q.data?.data ?? [];
    return {
      pending:  all.filter((r) => r.status === "pending").length,
      invited:  all.filter((r) => r.status === "invited").length,
      declined: all.filter((r) => r.status === "declined").length,
      all:      all.length,
    };
  }, [q.data]);

  async function doApprove(row: WaitlistAdminRow) {
    try {
      const res = await approve.mutateAsync({ id: row.id });
      setApproveResult(res.data);
    } catch (err) {
      const e = err as Error;
      toast.error(`Approve failed: ${e.message}`);
    }
  }

  async function doDecline(row: WaitlistAdminRow) {
    if (!confirm(`Decline ${row.email}? (Reversible — they can be approved later.)`)) return;
    try {
      await decline.mutateAsync(row.id);
      toast.success(`Declined ${row.email}`);
    } catch (err) {
      const e = err as Error;
      toast.error(`Decline failed: ${e.message}`);
    }
  }

  return (
    <ViewShell
      title="Waitlist"
      subtitle="Triage incoming requests for access to the hosted product. Approving creates the user account and shows credentials to copy into your invite email."
      actions={
        <span className="font-mono text-[11px] text-[var(--fg-muted)]">
          {counts.pending} pending · {counts.invited} invited · {counts.all} total
        </span>
      }
    >
      <div className="fx-toolbar mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "fx-btn fx-btn--sm",
              filter === f.key && "fx-btn--toggled",
            )}
          >
            {f.label}
            <span className="ml-1 font-mono text-[10px] text-[var(--fg-faint)]">
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center py-16 text-[12px] text-[var(--fg-muted)]">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          loading waitlist…
        </div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center py-16 text-center text-[12px] text-[var(--fg-muted)]">
          <Mail className="mb-2 h-5 w-5" />
          {filter === "pending" ? "No pending signups." : `No ${filter} entries.`}
        </div>
      ) : (
        <div className="fx-card overflow-hidden">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Use case</th>
                <th>Source</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[12px]">{r.email}</td>
                  <td>{r.role ?? <span className="text-[var(--fg-faint)]">—</span>}</td>
                  <td className="max-w-[28em] truncate" title={r.useCase ?? undefined}>
                    {r.useCase ?? <span className="text-[var(--fg-faint)]">—</span>}
                  </td>
                  <td className="mono">{r.source ?? <span className="text-[var(--fg-faint)]">—</span>}</td>
                  <td>{relTime(r.createdAt)}</td>
                  <td>
                    {r.status === "pending" && (
                      <span className="fx-chip fx-chip--info">pending</span>
                    )}
                    {r.status === "invited" && (
                      <span className="fx-chip fx-chip--success fx-chip--dot">invited · {relTime(r.invitedAt ?? r.createdAt)}</span>
                    )}
                    {r.status === "declined" && (
                      <span className="fx-chip">declined</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {r.status === "pending" ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="fx-btn fx-btn--sm fx-btn--primary"
                          onClick={() => doApprove(r)}
                          disabled={approve.isPending}
                        >
                          <UserCheck className="h-3 w-3" /> approve
                        </button>
                        <button
                          type="button"
                          className="fx-btn fx-btn--sm fx-btn--ghost"
                          onClick={() => doDecline(r)}
                          disabled={decline.isPending}
                        >
                          <UserX className="h-3 w-3" /> decline
                        </button>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--fg-faint)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approveResult && (
        <ApproveCredentialsModal
          result={approveResult}
          onClose={() => setApproveResult(null)}
        />
      )}
    </ViewShell>
  );
}

/**
 * Modal shown once after a successful approve. The temp password is
 * NOT stored anywhere server-side past the bcrypt hash — this is the
 * only time the admin sees it, so they have to copy it into their
 * invite email before closing.
 */
function ApproveCredentialsModal({
  result,
  onClose,
}: {
  result: WaitlistApproveResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const block = [
    `Email:    ${result.credentials.email}`,
    `Password: ${result.credentials.password}`,
    "",
    "Sign in at: https://demo.forenix.tech/sign-in",
    "We recommend rotating the password after first sign-in.",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — fall back to manual select
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--scrim)] p-4"
      onClick={onClose}
    >
      <div
        className="fx-card w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fx-card__head">
          <span className="fx-card__title flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
            Account created for {result.user.email}
          </span>
          <button type="button" onClick={onClose} className="fx-btn fx-btn--ghost fx-btn--icon fx-btn--sm">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="fx-card__body space-y-3">
          <p className="text-[13px] text-[var(--fg-muted)]">
            Copy these credentials into your invite email <strong>now</strong>.
            The password is only shown here once.
          </p>
          <pre className="fx-code whitespace-pre-wrap text-[12px]">{block}</pre>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={copy}
              className="fx-btn fx-btn--primary"
            >
              {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "copied" : "copy to clipboard"}
            </button>
            <button type="button" onClick={onClose} className="fx-btn">
              done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
