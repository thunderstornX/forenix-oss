"use client";

import {
  ArrowLeft,
  Telescope,
  Folders,
  GitCommit,
  ScrollText,
  Network,
  Radar,
  ShieldCheck,
  Lock,
  Check,
  GitMerge,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useInvestigation, usePromoteFinding, useVerifyFinding } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

interface Props {
  investigationId: string;
}

export function InvestigationDetail({ investigationId }: Props) {
  const setActive = useUI((s) => s.setActiveInvestigation);
  const setCase = useUI((s) => s.setActiveCase);
  const setView = useUI((s) => s.setView);
  const detail = useInvestigation(investigationId);
  const verify = useVerifyFinding();
  const promote = usePromoteFinding();
  const inv = detail.data?.data;

  async function onVerify(findingId: string) {
    try { await verify.mutateAsync({ id: findingId, investigationId }); toast.success("Finding verified"); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function onPromote(findingId: string) {
    try { const r = await promote.mutateAsync({ id: findingId, investigationId }); toast.success("Promoted to evidence"); void r; }
    catch (e) { toast.error((e as Error).message); }
  }

  if (detail.isLoading) {
    return (
      <ViewShell title="Investigation">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--foreground-muted)]">Loading…</div>
      </ViewShell>
    );
  }
  if (detail.error || !inv) {
    return (
      <ViewShell title="Investigation">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--danger)]">
          {(detail.error as Error)?.message ?? "Not found."}
        </div>
      </ViewShell>
    );
  }

  return (
    <ViewShell
      title={inv.title}
      subtitle={inv.objective}
      actions={
        <button
          type="button"
          onClick={() => setActive(null)}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      }
    >
      {/* Header strip */}
      <div className="glass-strong grid grid-cols-2 gap-4 rounded-lg p-4 sm:grid-cols-4">
        <DetailField label="Target" value={<span className="font-mono">{inv.target}</span>} />
        <DetailField label="Target type" value={<span className="capitalize">{inv.targetType}</span>} />
        <DetailField label="Status" value={<StatusChip text={inv.status} />} />
        <DetailField label="Priority" value={<span className="capitalize">{inv.priority}</span>} />
      </div>

      {/* Bridge to Case */}
      {inv.case && (
        <button
          type="button"
          onClick={() => {
            setCase(inv.case!.id);
            setView("cases");
          }}
          className="glass forensic-glow group flex w-full items-center justify-between rounded-lg p-4 text-left transition-colors hover:bg-[var(--background-elev)]"
        >
          <div className="flex items-center gap-3">
            <Folders className="h-4 w-4 text-[var(--forensic)]" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Forensic case
              </div>
              <div className="text-[13px] text-[var(--foreground)]">
                {inv.case.title} · <span className="font-mono text-[12px]">{inv.case.caseNumber}</span>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-[var(--forensic)] group-hover:underline">open →</span>
        </button>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell icon={<Telescope className="h-4 w-4 text-[var(--accent)]" />} label="findings" value={inv._count.findings} />
        <StatCell icon={<Network className="h-4 w-4 text-[var(--accent)]" />}   label="entities" value={inv._count.entities} />
        <StatCell icon={<Radar className="h-4 w-4 text-[var(--accent)]" />}      label="monitors" value={inv._count.monitors} />
        <StatCell icon={<ScrollText className="h-4 w-4 text-[var(--accent)]" />} label="reports"  value={inv._count.reports} />
      </div>

      {/* Findings */}
      <section className="glass rounded-lg p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">Findings ({inv.findings.length})</h3>
        <ul className="space-y-2">
          {inv.findings.map((f) => (
            <li key={f.id} className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                    <ShieldCheck className="h-3 w-3" />
                    {f.category}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[var(--foreground)]">{f.title}</div>
                  <div className="mt-1 text-[12px] text-[var(--foreground-muted)]">{f.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <ConfidenceChip c={f.confidence} />
                  {f.evidence && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--forensic)]">
                      <Lock className="h-3 w-3" />
                      <span className="font-mono">{shortHash(f.evidence.hash)}</span>
                    </div>
                  )}
                </div>
              </div>
              <SatTraceCard trace={f.reasoningTrace} />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--foreground-muted)]">
                <span>source: {f.sourceName}</span>
                <span>priority: {f.priority}</span>
                <span>verified: {f.verified ? "yes" : "no"}</span>
                <span>{relTime(f.createdAt)}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {!f.verified && (
                    <button
                      type="button"
                      onClick={() => onVerify(f.id)}
                      disabled={verify.isPending}
                      className="flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-0.5 text-[10px] text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50"
                    >
                      {verify.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      verify
                    </button>
                  )}
                  {inv.case && !f.evidence && (
                    <button
                      type="button"
                      onClick={() => onPromote(f.id)}
                      disabled={promote.isPending}
                      className="flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-0.5 text-[10px] text-[var(--forensic)] hover:border-[var(--forensic)] disabled:opacity-50"
                    >
                      {promote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
                      promote → evidence
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
          {inv.findings.length === 0 && (
            <li className="rounded border border-dashed border-[var(--border)] p-4 text-center text-[12px] text-[var(--foreground-muted)]">
              No findings yet — run the pipeline.
            </li>
          )}
        </ul>
      </section>

      {/* Monitors + Reports */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="glass rounded-lg p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Monitors ({inv.monitors.length})</h3>
          <ul className="space-y-1.5">
            {inv.monitors.map((m) => (
              <li key={m.id} className="rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-mono text-[var(--foreground)]">{m.target}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">{m.cadence}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
                  next run: {m.nextRunAt ? relTime(m.nextRunAt) : "—"}
                </div>
              </li>
            ))}
            {inv.monitors.length === 0 && (
              <li className="text-center text-[11px] text-[var(--foreground-muted)]">none</li>
            )}
          </ul>
        </section>
        <section className="glass rounded-lg p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Reports ({inv.reports.length})</h3>
          <ul className="space-y-1.5">
            {inv.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-[var(--foreground)]">{r.title}</div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">
                    {r.type} · {r.findingCount} findings
                  </div>
                </div>
                <StatusChip text={r.status} />
              </li>
            ))}
            {inv.reports.length === 0 && (
              <li className="text-center text-[11px] text-[var(--foreground-muted)]">none</li>
            )}
          </ul>
        </section>
      </div>

      {/* Audit trail */}
      <section className="glass rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Audit trail ({inv.auditLogs.length})</h3>
        <ul className="relative space-y-0.5">
          {inv.auditLogs.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded px-2 py-1.5 text-[12px] hover:bg-[var(--background-elev)]">
              <GitCommit className="h-3 w-3 shrink-0 text-[var(--accent)]" />
              <span className="w-44 truncate font-mono text-[10px] text-[var(--foreground-muted)]">
                {shortHash(a.hash)}
              </span>
              <span className="flex-1 truncate text-[var(--foreground)]">
                {a.action} <span className="text-[var(--foreground-muted)]">on {a.entity}</span>
              </span>
              <span className="shrink-0 text-[10px] text-[var(--foreground-muted)]">{relTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </ViewShell>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">{label}</div>
      <div className="mt-1 text-[13px] text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function StatCell({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: number }) {
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

export function StatusChip({ text }: { text: string }) {
  const tone =
    text === "complete" || text === "open"
      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : text === "running" || text === "in_progress" || text === "investigating"
      ? "bg-[rgba(245,158,11,0.12)] text-[var(--warn)]"
      : text === "draft" || text === "pending"
      ? "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]"
      : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", tone)}>{text}</span>
  );
}

function ConfidenceChip({ c }: { c: string }) {
  const map: Record<string, string> = {
    confirmed: "text-[var(--accent-strong)]",
    probable: "text-[var(--warn)]",
    unverified: "text-[var(--foreground-muted)]",
    disputed: "text-[var(--danger)]",
    false: "text-[var(--danger)]",
  };
  return <span className={cn("text-[10px] uppercase tracking-[0.18em]", map[c] ?? "")}>{c}</span>;
}

// ─────────────────── SatTrace renderer ────────────────────────────

interface SatTrace {
  technique?: string;
  inputs?: Array<{
    sourceId?: string;
    summary?: string;
    credibility?: number;
    recencyDays?: number;
  }>;
  reasoning?: string;
  outputCandidates?: Array<{
    label?: string;
    weight?: number;
    disconfirmingEvidence?: string[];
  }>;
  selected?: number;
}

function SatTraceCard({ trace }: { trace: string }) {
  if (!trace || typeof trace !== "string") return null;
  // Old-style free-text traces render as a one-liner.
  if (!trace.trim().startsWith("{")) {
    return (
      <div className="mt-2 rounded border border-[var(--border)] bg-[var(--background-elev-2)] p-2 text-[11px] italic text-[var(--foreground-muted)]">
        {trace.slice(0, 280)}
      </div>
    );
  }
  let parsed: SatTrace | null = null;
  try {
    parsed = JSON.parse(trace) as SatTrace;
  } catch {
    return null;
  }
  if (!parsed?.technique) return null;
  return (
    <div className="mt-2 rounded border border-[var(--accent)] bg-[var(--background-elev-2)] p-2.5 text-[11px]">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          {parsed.technique}
        </span>
        <span className="text-[10px] text-[var(--foreground-muted)]">analytic technique</span>
      </div>
      {parsed.reasoning && (
        <p className="mb-2 text-[var(--foreground)]">{parsed.reasoning}</p>
      )}
      {parsed.outputCandidates && parsed.outputCandidates.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Hypotheses ({parsed.outputCandidates.length})
          </div>
          {parsed.outputCandidates.slice(0, 4).map((h, i) => (
            <div
              key={i}
              className={cn(
                "rounded border px-2 py-1 text-[10px]",
                i === parsed!.selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--border)] bg-[var(--background-elev)] text-[var(--foreground-muted)]",
              )}
            >
              <div className="flex items-center justify-between">
                <span>{h.label ?? "(unlabelled)"}</span>
                <span className="font-mono">w={typeof h.weight === "number" ? h.weight.toFixed(2) : "?"}</span>
              </div>
              {h.disconfirmingEvidence && h.disconfirmingEvidence.length > 0 && (
                <ul className="mt-0.5 list-disc pl-4 text-[10px] text-[var(--foreground-muted)]">
                  {h.disconfirmingEvidence.slice(0, 3).map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {parsed.inputs && parsed.inputs.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Inputs ({parsed.inputs.length})
          </div>
          <ul className="mt-0.5 space-y-0.5 text-[10px] text-[var(--foreground-muted)]">
            {parsed.inputs.slice(0, 4).map((inp, i) => (
              <li key={i}>
                <span className="font-mono">{inp.sourceId ?? "?"}</span>
                {typeof inp.credibility === "number" ? ` · cred=${inp.credibility}/5` : ""}
                {inp.summary ? ` — ${inp.summary.slice(0, 120)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
