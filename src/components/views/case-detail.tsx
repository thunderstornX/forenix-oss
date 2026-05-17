"use client";

import {
  ArrowLeft,
  Archive,
  FileText,
  GitBranch,
  GitCommit,
  GitMerge,
  Telescope,
  Users,
  Sparkles,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useCase, useSealEvidence } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { relTime, shortHash } from "@/lib/utils";

import { StatusChip } from "./investigation-detail";
import { ViewShell } from "./view-shell";

interface Props {
  caseId: string;
}

export function CaseDetail({ caseId }: Props) {
  const setActiveCase = useUI((s) => s.setActiveCase);
  const setActiveInv = useUI((s) => s.setActiveInvestigation);
  const setView = useUI((s) => s.setView);
  const detail = useCase(caseId);
  const seal = useSealEvidence();
  const c = detail.data?.data;

  async function onSeal(evidenceId: string) {
    try { await seal.mutateAsync({ id: evidenceId, caseId }); toast.success("Evidence sealed"); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (detail.isLoading) {
    return (
      <ViewShell title="Case">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--foreground-muted)]">Loading...</div>
      </ViewShell>
    );
  }
  if (detail.error || !c) {
    return (
      <ViewShell title="Case">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--danger)]">
          {(detail.error as Error)?.message ?? "Not found."}
        </div>
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title={c.title}
      subtitle={c.description}
      actions={
        <>
          <a
            href={`/api/cases/${caseId}/report?format=pdf`}
            download
            className="fx-btn fx-btn--sm"
            title="Download forensic case report (PDF) with chain attestation"
          >
            <FileText size={13} />
            Export PDF
          </a>
          <a
            href={`/api/cases/${caseId}/report`}
            target="_blank"
            rel="noopener"
            className="fx-btn fx-btn--ghost fx-btn--sm"
            title="Preview the report in a new tab (no PDF)"
          >
            Preview
          </a>
          <button
            type="button"
            onClick={() => setActiveCase(null)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </>
      }
    >
      {/* Header strip */}
      <div className="glass-strong grid grid-cols-2 gap-4 rounded-lg p-4 sm:grid-cols-4">
        <Field label="Case #" value={<span className="font-mono">{c.caseNumber}</span>} />
        <Field label="Status" value={<StatusChip text={c.status} />} />
        <Field label="Priority" value={<span className="capitalize">{c.priority}</span>} />
        <Field label="Progress" value={`${c.progress}%`} />
      </div>

      {/* Linked investigations bridge */}
      {c.investigations.length > 0 && (
        <section className="glass rounded-lg p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">
            Linked investigations ({c.investigations.length})
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {c.investigations.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => { setActiveInv(inv.id); setView("investigations"); }}
                className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2 text-left hover:border-[var(--accent)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    <Telescope className="h-3 w-3" /> {inv.targetType}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--foreground)]">{inv.title}</div>
                  <div className="truncate font-mono text-[10px] text-[var(--foreground-muted)]">{inv.target}</div>
                </div>
                <StatusChip text={inv.status} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Archive className="h-4 w-4 text-[var(--forensic)]" />} label="evidence" value={c.evidence.length} />
        <Stat icon={<GitBranch className="h-4 w-4 text-[var(--forensic)]" />} label="branches" value={c.branches.length} />
        <Stat icon={<GitMerge className="h-4 w-4 text-[var(--forensic)]" />} label="merge requests" value={c.mergeRequests.length} />
        <Stat icon={<Users className="h-4 w-4 text-[var(--forensic)]" />} label="assignees" value={c.assignments.length} />
      </div>

      {/* Evidence */}
      <section className="glass rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Evidence ({c.evidence.length})</h3>
        <div className="space-y-3">
          {c.evidence.map((ev) => (
            <article key={ev.id} className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-3">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                    <Archive className="h-3 w-3 text-[var(--forensic)]" />
                    {ev.type} | {ev.mimeType ?? "n/a"}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[var(--foreground)]">{ev.name}</div>
                  {ev.description && (
                    <div className="mt-1 text-[12px] text-[var(--foreground-muted)]">{ev.description}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded bg-[var(--background-elev-2)] px-1.5 py-0.5 text-[10px] font-medium capitalize text-[var(--forensic)]">
                    {ev.status}
                  </span>
                  <div className="mt-1 font-mono text-[10px] text-[var(--foreground-muted)]">{shortHash(ev.hash)}</div>
                  {ev.status !== "sealed" && (
                    <button
                      type="button"
                      onClick={() => onSeal(ev.id)}
                      disabled={seal.isPending}
                      className="mt-1 flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-0.5 text-[10px] text-[var(--foreground)] hover:border-[var(--forensic)] disabled:opacity-50"
                    >
                      {seal.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                      seal
                    </button>
                  )}
                </div>
              </header>
              {/* Commit chain */}
              <div className="mt-3">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  Commit chain ({ev.commits.length})
                </div>
                <ul className="space-y-1">
                  {ev.commits.map((commit) => (
                    <li key={commit.id} className="flex items-center gap-2 rounded bg-[var(--background-elev-2)] px-2 py-1.5 text-[11px]">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: commit.branch.color }}
                      />
                      <span className="font-mono text-[10px] text-[var(--foreground-muted)]">{shortHash(commit.commitHash)}</span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                        {commit.changeType}
                      </span>
                      <span className="flex-1 truncate text-[var(--foreground)]">{commit.message}</span>
                      <span className="text-[10px] text-[var(--foreground-muted)]">[{commit.branch.name}]</span>
                      <span className="text-[10px] text-[var(--foreground-muted)]">{relTime(commit.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
          {c.evidence.length === 0 && (
            <div className="rounded border border-dashed border-[var(--border)] p-4 text-center text-[12px] text-[var(--foreground-muted)]">
              No evidence yet.
            </div>
          )}
        </div>
      </section>

      {/* Branches + Assignments */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="glass rounded-lg p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Branches</h3>
          <ul className="space-y-1.5">
            {c.branches.map((b) => (
              <li key={b.id} className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                <span className="text-[12px] text-[var(--foreground)]">{b.name}</span>
                {b.isMain && (
                  <span className="rounded bg-[var(--accent-soft)] px-1 py-0.5 text-[9px] text-[var(--accent-strong)]">main</span>
                )}
                <span className="ml-auto text-[10px] text-[var(--foreground-muted)]">
                  {b._count.commits} commits | {b._count.merges} MRs
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass rounded-lg p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Assignees + agents</h3>
          <ul className="space-y-1.5">
            {c.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1.5 text-[12px]">
                <span className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-[var(--foreground-muted)]" />
                  {a.user.name}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">{a.role}</span>
              </li>
            ))}
            {c.agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1.5 text-[12px]">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                  {a.agent.name}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">{a.agent.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Audit trail */}
      <section className="glass rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Recent audit entries ({c.auditLogs.length})</h3>
        <ul className="space-y-0.5">
          {c.auditLogs.slice(-10).map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded px-2 py-1.5 text-[12px] hover:bg-[var(--background-elev)]">
              <GitCommit className="h-3 w-3 shrink-0 text-[var(--forensic)]" />
              <span className="w-40 truncate font-mono text-[10px] text-[var(--foreground-muted)]">{shortHash(a.hash)}</span>
              <span className="flex-1 truncate text-[var(--foreground)]">
                {a.action} <span className="text-[var(--foreground-muted)]">on {a.entity}</span>
              </span>
              <span className="text-[10px] text-[var(--foreground-muted)]">{relTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </ViewShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">{label}</div>
      <div className="mt-1 text-[13px] text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}
