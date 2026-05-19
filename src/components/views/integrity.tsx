"use client";

import { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Stamp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { useLiveEvents } from "@/hooks/use-live-events";
import {
  useAttestations,
  useAttestationSchedules,
  useCreateAttestation,
  useCreateAttestationSchedule,
  useDeleteAttestationSchedule,
  useIntegrity,
  useMe,
  usePatchAttestationSchedule,
  useVerifyAttestation,
  type AttestationRow,
  type AttestationScheduleRow,
  type AttestationVerifyResult,
} from "@/lib/hooks";
import { relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

export function IntegrityView() {
  const integ = useIntegrity();
  const data = integ.data?.data;
  const ok = data?.ok === true;

  // Live updates: attestation runs (manual or scheduled) and every
  // audit append both move the head, so we refresh the integrity view
  // and the attestation tables on either signal.
  const qc = useQueryClient();
  useLiveEvents(
    ["attestation.run.started", "attestation.run.completed", "audit.append"],
    () => {
      qc.invalidateQueries({ queryKey: ["integrity"] });
      qc.invalidateQueries({ queryKey: ["attestations"] });
      qc.invalidateQueries({ queryKey: ["attestation-schedules"] });
    },
  );

  return (
    <ViewShell
      title="Integrity"
      subtitle="Replay the entire audit log in insertion order and verify every row's SHA-256 against the recomputed value."
      actions={
        <button
          type="button"
          onClick={() => integ.refetch()}
          disabled={integ.isFetching}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-strong)] disabled:opacity-60"
        >
          {integ.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
          Verify chain
        </button>
      }
    >
      {/* Headline state card */}
      <div
        className={
          ok
            ? "glass-strong rounded-lg p-6 forensic-glow"
            : "glass-strong rounded-lg p-6 border-[var(--danger)] bg-[rgba(239,68,68,0.05)]"
        }
      >
        <div className="flex items-start gap-4">
          {ok ? (
            <CheckCircle2 className="h-7 w-7 shrink-0 text-[var(--accent-strong)]" />
          ) : data ? (
            <AlertOctagon className="h-7 w-7 shrink-0 text-[var(--danger)]" />
          ) : (
            <Loader2 className="h-7 w-7 shrink-0 animate-spin text-[var(--foreground-muted)]" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              {ok ? "Chain verified" : data ? "Chain broken" : "Verifying"}
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--foreground)]">
              {ok
                ? `${data!.entries} entries  -  every hash recomputes to the stored value.`
                : data
                ? `Broken at row ${shortHash(data.brokenAt)} of ${data.entries}.`
                : "Replaying..."}
            </div>
            {data && !data.ok && (
              <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                <DiffField label="Expected hash" value={data.expected} />
                <DiffField label="Stored hash"   value={data.got} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Method blurb */}
      <div className="glass rounded-lg p-4 text-[12px] text-[var(--foreground-muted)]">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Method</div>
        <pre className="mt-2 overflow-x-auto rounded bg-[var(--background-elev-2)] p-3 font-mono text-[11px] text-[var(--foreground)]">
{`hash(row_n) = sha256(
  hash(row_{n-1})
  | action
  | entity
  | entityId
  | iso(createdAt)
)`}
        </pre>
        <p className="mt-2">
          Replay walks the table in <code className="font-mono">createdAt</code> order,
          recomputes each row's hash from the previous row's hash, and stops at the first
          mismatch. <code className="font-mono">GENESIS_HASH</code> is 32 zero bytes,
          hex-encoded. The walk is cheap  -  a single
          <code className="font-mono"> findMany</code> + a CPU loop.
        </p>
      </div>

      <AttestationsPanel />
      <SchedulesPanel />
    </ViewShell>
  );
}

function AttestationsPanel() {
  const me = useMe();
  const role = me.data?.data?.role;
  const isAdmin = role === "admin";

  const list = useAttestations();
  const create = useCreateAttestation();
  const verify = useVerifyAttestation();
  const [chosenBackend, setChosenBackend] = useState<string>("");
  const [lastVerdict, setLastVerdict] = useState<
    Record<string, AttestationVerifyResult["verdict"] | undefined>
  >({});
  const rows = list.data?.data ?? [];
  const backends = list.data?.backends ?? [];

  async function attestNow() {
    try {
      await create.mutateAsync(chosenBackend ? { backend: chosenBackend } : {});
    } catch {
      // toast surface lives in a layer above; per-mutation error is in create.error
    }
  }

  async function verifyRow(id: string) {
    try {
      const res = await verify.mutateAsync(id);
      setLastVerdict((prev) => ({ ...prev, [id]: res.data.verdict }));
    } catch (e) {
      setLastVerdict((prev) => ({
        ...prev,
        [id]: { ok: false, details: (e as Error).message },
      }));
    }
  }

  return (
    <div className="glass rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            External attestations
          </div>
          <div className="mt-1 text-[13px] font-medium text-[var(--foreground)]">
            Periodic witnesses of the chain head
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--foreground-muted)]">
            The chain alone proves no-tampering only against attackers without DB-write
            access. External attestations pin the head to a witness the maintainer
            can&apos;t silently rewrite, so a re-signed chain is still detectable by
            comparing today&apos;s head against historically-witnessed heads.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {backends.length > 1 && (
              <select
                value={chosenBackend}
                onChange={(e) => setChosenBackend(e.target.value)}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1.5 text-[12px] text-[var(--foreground)]"
                title="Backend (env default if unset)"
              >
                <option value="">Default backend</option>
                {backends.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={attestNow}
              disabled={create.isPending}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-strong)] disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Stamp className="h-3.5 w-3.5" />
              )}
              Attest now
            </button>
          </div>
        )}
      </div>

      {create.error && (
        <div className="mt-3 rounded border border-[var(--danger)] bg-[rgba(239,68,68,0.05)] p-2 text-[11px] text-[var(--danger)]">
          {(create.error as Error).message}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--background-elev-2)] text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Backend</th>
              <th className="px-3 py-2 text-left">Head</th>
              <th className="px-3 py-2 text-left">Entries</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Witness</th>
              <th className="px-3 py-2 text-right">Verify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-[12px] text-[var(--foreground-muted)]"
                >
                  No attestations yet.
                  {isAdmin
                    ? " Click “Attest now” above to witness the current head."
                    : " An admin can record one from this page."}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <AttestationRowView
                key={row.id}
                row={row}
                verdict={lastVerdict[row.id]}
                verifying={verify.isPending && verify.variables === row.id}
                onVerify={() => verifyRow(row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttestationRowView({
  row,
  verdict,
  verifying,
  onVerify,
}: {
  row: AttestationRow;
  verdict: AttestationVerifyResult["verdict"] | undefined;
  verifying: boolean;
  onVerify: () => void;
}) {
  return (
    <tr className="text-[var(--foreground)]">
      <td className="px-3 py-2 font-mono text-[11px]">{row.backend}</td>
      <td className="px-3 py-2 font-mono text-[11px]" title={row.headHash}>
        {shortHash(row.headHash)}
      </td>
      <td className="px-3 py-2 tabular-nums">{row.entries}</td>
      <td className="px-3 py-2">
        <StatusPill status={row.status} />
      </td>
      <td className="px-3 py-2 text-[var(--foreground-muted)]">
        {relTime(row.createdAt)}
      </td>
      <td className="px-3 py-2">
        {row.externalUrl ? (
          <a
            href={row.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent-strong)] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {row.externalRef ?? "open"}
          </a>
        ) : row.externalRef ? (
          <span className="font-mono text-[11px] text-[var(--foreground-muted)]">
            {row.externalRef}
          </span>
        ) : (
          <span className="text-[var(--foreground-muted)]">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {verdict && (
            <span
              title={verdict.details ?? ""}
              className={
                verdict.ok
                  ? "inline-flex items-center gap-1 text-[var(--accent-strong)]"
                  : "inline-flex items-center gap-1 text-[var(--danger)]"
              }
            >
              {verdict.ok ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldOff className="h-3.5 w-3.5" />
              )}
              {verdict.ok ? "verified" : "mismatch"}
            </span>
          )}
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1 text-[11px] disabled:opacity-60"
          >
            {verifying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Verify
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: AttestationRow["status"] }) {
  const map: Record<AttestationRow["status"], string> = {
    confirmed:
      "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent-strong)]",
    submitted:
      "bg-[var(--background-elev-2)] text-[var(--foreground-muted)] border-[var(--border-strong)]",
    failed:
      "border-[var(--danger)] bg-[rgba(239,68,68,0.08)] text-[var(--danger)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${map[status]}`}
    >
      {status}
    </span>
  );
}

function DiffField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] text-[var(--foreground)]">{value}</div>
    </div>
  );
}

/* ─────────────────────  SchedulesPanel (admin only) ──────────────
   Cron-triggered attestations  -  one row per backend the operator
   wants fired on a schedule. Reuses the Monitor scheduler's cadence
   parser so the cadence grammar is identical.
   ───────────────────────────────────────────────────────────────── */

function SchedulesPanel() {
  const me = useMe();
  const isAdmin = me.data?.data?.role === "admin";

  const list = useAttestationSchedules();
  const create = useCreateAttestationSchedule();
  const patch = usePatchAttestationSchedule();
  const del = useDeleteAttestationSchedule();

  const [showCreate, setShowCreate] = useState(false);
  const [pickBackend, setPickBackend] = useState<string>("local");
  const [pickCadence, setPickCadence] = useState<string>("daily");

  if (!isAdmin) return null;

  const rows = list.data?.data ?? [];
  const backends = list.data?.backends ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ backend: pickBackend, cadence: pickCadence });
      toast.success("Schedule created  -  first run within ~30 s");
      setShowCreate(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggle(s: AttestationScheduleRow) {
    try {
      await patch.mutateAsync({ id: s.id, enabled: !s.enabled });
      toast.success(s.enabled ? "Paused" : "Resumed");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function changeCadence(s: AttestationScheduleRow, next: string) {
    if (next === s.cadence) return;
    try {
      await patch.mutateAsync({ id: s.id, cadence: next });
      toast.success("Cadence updated");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(s: AttestationScheduleRow) {
    if (!confirm(`Delete the ${s.backend} schedule?`)) return;
    try {
      await del.mutateAsync(s.id);
      toast.success("Schedule deleted");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="glass rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Scheduled attestations
          </div>
          <div className="mt-1 text-[13px] font-medium text-[var(--foreground)]">
            Automatic chain self-witnessing
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--foreground-muted)]">
            Each schedule fires its backend on its cadence. Driven by
            the same cron infrastructure as Monitors (Vercel Cron +
            GitHub Actions + systemd timer); see
            <code className="mx-1 font-mono">docs/09-RUNBOOK.md ยง11</code>
            for setup.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-strong)]"
        >
          <Plus className="h-3.5 w-3.5" />
          New schedule
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={submit}
          className="mt-3 grid grid-cols-1 gap-2 rounded border border-[var(--border)] bg-[var(--background-elev)] p-3 sm:grid-cols-4"
        >
          <select
            value={pickBackend}
            onChange={(e) => setPickBackend(e.target.value)}
            className="rounded border border-[var(--border-strong)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]"
          >
            {backends.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
          <select
            value={pickCadence}
            onChange={(e) => setPickCadence(e.target.value)}
            className="rounded border border-[var(--border-strong)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]"
          >
            <option value="hourly">Hourly</option>
            <option value="every:6h">Every 6 hours</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg-on-accent)] disabled:opacity-60 sm:col-span-2"
          >
            {create.isPending ? "Creating..." : "Create schedule"}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--background-elev-2)] text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Backend</th>
              <th className="px-3 py-2 text-left">Cadence</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Last run</th>
              <th className="px-3 py-2 text-left">Next run</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-[var(--foreground-muted)]">
                  No automatic schedules yet. Use "New schedule" to add one.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="text-[var(--foreground)]">
                <td className="px-3 py-2 font-mono text-[11px]">{s.backend}</td>
                <td className="px-3 py-2">
                  <select
                    value={s.cadence}
                    onChange={(e) => changeCadence(s, e.target.value)}
                    className="rounded border border-[var(--border)] bg-[var(--background-elev)] px-1.5 py-0.5 text-[11px]"
                  >
                    {!["hourly", "every:6h", "daily", "weekly", "monthly"].includes(s.cadence) && (
                      <option value={s.cadence}>{s.cadence}</option>
                    )}
                    <option value="hourly">Hourly</option>
                    <option value="every:6h">Every 6h</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      s.enabled
                        ? "inline-flex items-center gap-1 rounded border border-[var(--accent-strong)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--accent-strong)]"
                        : "inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--background-elev-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)]"
                    }
                  >
                    {s.enabled ? "active" : "paused"}
                  </span>
                  {s.lastError && (
                    <div className="mt-0.5 text-[10px] text-[var(--danger)]" title={s.lastError}>
                      last error: {s.lastError.slice(0, 60)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--foreground-muted)]">
                  {s.lastRunAt ? relTimeShort(s.lastRunAt) : "—"}
                </td>
                <td className="px-3 py-2 text-[var(--foreground-muted)]">
                  {s.nextRunAt ? relTimeShort(s.nextRunAt) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--background-elev)] px-2 py-1 text-[10px]"
                    >
                      {s.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {s.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background-elev)] px-2 py-1 text-[10px] text-[var(--foreground-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function relTimeShort(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const absMin = Math.abs(diff) / 60000;
  if (absMin < 1) return diff < 0 ? "just now" : "in <1m";
  if (absMin < 60) return diff < 0 ? `${Math.round(absMin)}m ago` : `in ${Math.round(absMin)}m`;
  const absH = absMin / 60;
  if (absH < 24) return diff < 0 ? `${Math.round(absH)}h ago` : `in ${Math.round(absH)}h`;
  const absD = absH / 24;
  return diff < 0 ? `${Math.round(absD)}d ago` : `in ${Math.round(absD)}d`;
}
