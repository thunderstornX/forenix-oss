"use client";

import { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Stamp,
} from "lucide-react";

import {
  useAttestations,
  useCreateAttestation,
  useIntegrity,
  useMe,
  useVerifyAttestation,
  type AttestationRow,
  type AttestationVerifyResult,
} from "@/lib/hooks";
import { relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

export function IntegrityView() {
  const integ = useIntegrity();
  const data = integ.data?.data;
  const ok = data?.ok === true;

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
