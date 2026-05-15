"use client";

import { CheckCircle2, AlertOctagon, Loader2, Shield } from "lucide-react";

import { useIntegrity } from "@/lib/hooks";
import { shortHash } from "@/lib/utils";

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
                ? `${data!.entries} entries — every hash recomputes to the stored value.`
                : data
                ? `Broken at row ${shortHash(data.brokenAt)} of ${data.entries}.`
                : "Replaying…"}
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
          hex-encoded. The walk is cheap — a single
          <code className="font-mono"> findMany</code> + a CPU loop.
        </p>
      </div>
    </ViewShell>
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
