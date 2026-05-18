"use client";

import { useState } from "react";
import {
  Loader2,
  Pause,
  Play,
  Plus,
  Radar,
  Telescope,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  useCreateMonitor,
  useDeleteMonitor,
  useInvestigations,
  useMe,
  useMonitors,
  usePatchMonitor,
  useRunMonitorNow,
  type MonitorRow,
} from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

const CADENCE_OPTIONS = [
  { value: "hourly",      label: "Hourly" },
  { value: "every:6h",    label: "Every 6 hours" },
  { value: "daily",       label: "Daily" },
  { value: "weekly",      label: "Weekly" },
  { value: "monthly",     label: "Monthly" },
];

export function MonitorsView() {
  const m = useMonitors();
  const setInv = useUI((s) => s.setActiveInvestigation);
  const setView = useUI((s) => s.setView);
  const rows = m.data?.data ?? [];

  const me = useMe();
  const role = me.data?.data?.role;
  const canWrite = role === "admin" || role === "investigator";

  const [creating, setCreating] = useState(false);

  return (
    <ViewShell
      title="Monitors"
      subtitle="Cadenced re-runs of each investigation. The scheduler ticks every 5 min; each run records delta findings the next sweep should chase."
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--foreground-muted)]">
            {rows.filter((r) => r.status === "active").length} active / {rows.length} total
          </span>
          {canWrite && (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]"
            >
              <Plus className="h-3 w-3" /> New monitor
            </button>
          )}
        </div>
      }
    >
      {creating && canWrite && (
        <CreateMonitorForm onClose={() => setCreating(false)} />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <MonitorCard
            key={r.id}
            row={r}
            canWrite={canWrite}
            onOpenInv={() => {
              if (r.investigation) {
                setInv(r.investigation.id);
                setView("investigations");
              }
            }}
          />
        ))}
        {rows.length === 0 && !m.isLoading && (
          <div className="glass col-span-full rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            No monitors yet.{canWrite ? " Use 'New monitor' to create one." : ""}
          </div>
        )}
      </div>
    </ViewShell>
  );
}

/* ────────────────────────  one card  ──────────────────────────── */

function MonitorCard({
  row,
  canWrite,
  onOpenInv,
}: {
  row: MonitorRow;
  canWrite: boolean;
  onOpenInv: () => void;
}) {
  const patch = usePatchMonitor();
  const del = useDeleteMonitor();
  const runNow = useRunMonitorNow();

  async function toggleStatus() {
    try {
      await patch.mutateAsync({
        id: row.id,
        status: row.status === "active" ? "paused" : "active",
      });
      toast.success(row.status === "active" ? "Monitor paused" : "Monitor resumed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function changeCadence(next: string) {
    if (next === row.cadence) return;
    try {
      await patch.mutateAsync({ id: row.id, cadence: next });
      toast.success("Cadence updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    if (!confirm(`Delete monitor for ${row.target}?`)) return;
    try {
      await del.mutateAsync(row.id);
      toast.success("Monitor deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function fireNow() {
    try {
      await runNow.mutateAsync(row.id);
      toast.success("Run completed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const busy = patch.isPending || del.isPending || runNow.isPending;

  return (
    <article className="glass rounded-lg p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            <Radar className="h-3 w-3 text-[var(--accent)]" />
            <span>{row.cadence}</span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-[var(--foreground)]">
            <span className="font-mono">{row.target}</span> | {row.targetType}
          </div>
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
            row.status === "active"
              ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
              : "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
          )}
        >
          {row.status}
        </span>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Last run
          </div>
          <div className="mt-0.5 text-[var(--foreground)]">
            {row.lastRunAt ? relTime(row.lastRunAt) : " - "}
          </div>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Next run
          </div>
          <div className="mt-0.5 text-[var(--foreground)]">
            {row.nextRunAt ? relTime(row.nextRunAt) : " - "}
          </div>
        </div>
      </div>

      {row.runs.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Recent runs
          </div>
          <ul className="mt-1 space-y-1">
            {row.runs.map((run) => (
              <li
                key={run.id}
                className="flex items-center justify-between rounded bg-[var(--background-elev-2)] px-2 py-1 text-[11px]"
              >
                <span>
                  {run.status} | {run.findingsCount} findings
                </span>
                <span className="text-[10px] text-[var(--foreground-muted)]">
                  {relTime(run.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {row.investigation && (
        <button
          type="button"
          onClick={onOpenInv}
          className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--accent)] hover:underline"
        >
          <Telescope className="h-3 w-3" />
          {row.investigation.title}
        </button>
      )}

      {canWrite && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={fireNow}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-medium text-[var(--accent-strong)] disabled:opacity-60"
            title="Run now (bypasses next scheduled tick)"
          >
            {runNow.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Run now
          </button>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)] disabled:opacity-60"
          >
            {row.status === "active" ? (
              <>
                <Pause className="h-3 w-3" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3" /> Resume
              </>
            )}
          </button>
          <select
            value={row.cadence}
            onChange={(e) => changeCadence(e.target.value)}
            disabled={busy}
            className="rounded border border-[var(--border)] bg-[var(--background-elev)] px-1.5 py-1 text-[10px] text-[var(--foreground)] disabled:opacity-60"
            title="Change cadence"
          >
            {/* If the current value isn't one of the named options, surface it as a literal */}
            {!CADENCE_OPTIONS.some((o) => o.value === row.cadence) && (
              <option value={row.cadence}>{row.cadence}</option>
            )}
            {CADENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background-elev)] px-2 py-1 text-[10px] text-[var(--foreground-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-60"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

/* ────────────────────────  create form  ───────────────────────── */

function CreateMonitorForm({ onClose }: { onClose: () => void }) {
  const invs = useInvestigations();
  const create = useCreateMonitor();
  const [investigationId, setInvId] = useState<string>("");
  const [target, setTarget] = useState("");
  const [targetType, setTargetType] = useState("domain");
  const [cadence, setCadence] = useState("weekly");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        investigationId: investigationId || undefined,
        target: target.trim(),
        targetType,
        cadence,
      });
      toast.success("Monitor created  -  first run scheduled within a minute");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="glass mb-3 grid grid-cols-1 gap-2 rounded-lg p-4 sm:grid-cols-5"
    >
      <input
        required
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="target (e.g. github.com, @username, foo@bar.com)"
        className="rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1.5 text-[12px] sm:col-span-2"
      />
      <select
        value={targetType}
        onChange={(e) => setTargetType(e.target.value)}
        className="rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1.5 text-[12px]"
      >
        {["domain", "username", "email", "ip", "url"].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={cadence}
        onChange={(e) => setCadence(e.target.value)}
        className="rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1.5 text-[12px]"
      >
        {CADENCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={investigationId}
        onChange={(e) => setInvId(e.target.value)}
        className="rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1.5 text-[12px] sm:col-span-2"
      >
        <option value="">Standalone (no investigation linked)</option>
        {(invs.data?.data ?? []).map((i) => (
          <option key={i.id} value={i.id}>
            {i.title}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2 sm:col-span-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[var(--border)] bg-transparent px-3 py-1 text-[12px] text-[var(--foreground-muted)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="inline-flex items-center gap-1 rounded bg-[var(--accent)] px-3 py-1 text-[12px] font-medium text-[var(--fg-on-accent)] disabled:opacity-60"
        >
          {create.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Create monitor
        </button>
      </div>
    </form>
  );
}
