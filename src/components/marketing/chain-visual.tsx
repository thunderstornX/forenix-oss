"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * Animated chain-of-custody visual for the hero — a terminal-shaped
 * card that progressively grows hash-linked rows. Each new row's
 * prevHash points at the previous row's hash, mirroring the real
 * audit chain's data model.
 *
 * Pure SSR-safe: no random numbers, no Date.now() in render output.
 */

interface Row {
  id: string;
  action: string;
  hash: string;
  attest?: { backend: string; ref: string };
}

const ROWS: Row[] = [
  { id: "ckxw1", action: "create_investigation", hash: "0e7c3a91" },
  { id: "ckxw2", action: "run_pipeline",         hash: "4f1b0c8d" },
  { id: "ckxw3", action: "promote_to_evidence",  hash: "2a90fc41" },
  { id: "ckxw4", action: "verify_evidence",      hash: "9d4ec2b6" },
  { id: "ckxw5", action: "seal_case",            hash: "61b3a04f" },
  {
    id: "ckxw6",
    action: "attest_chain",
    hash: "8c7a2e10",
    attest: { backend: "rekor", ref: "163847219" },
  },
];

export function ChainVisual() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= ROWS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="relative w-full">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-elev)]/80 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        {/* terminal chrome */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)]/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]/60" />
          </div>
          <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--foreground-muted)] uppercase">
            audit chain · live
          </span>
          <span className="font-mono text-[10px] text-[var(--foreground-faint)]">
            sha-256
          </span>
        </div>

        <div className="space-y-1.5 p-4 font-mono text-[11px] leading-relaxed sm:text-[12px]">
          {ROWS.slice(0, step).map((r, idx) => (
            <ChainRow
              key={r.id}
              row={r}
              prev={idx === 0 ? "0".repeat(8) : ROWS[idx - 1]!.hash}
              isAttest={!!r.attest}
            />
          ))}
          {step < ROWS.length && <CursorRow />}
        </div>

        {/* footer chip — appears after attest row lands */}
        {step >= ROWS.length && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background-elev-2)] px-4 py-2.5 text-[11px]"
          >
            <span className="text-[var(--foreground-muted)]">
              <span className="text-[var(--accent-strong)]">●</span> chain verified ·{" "}
              {ROWS.length} entries · witnessed on{" "}
              <span className="text-[var(--foreground)]">rekor.sigstore.dev</span>
            </span>
            <span className="font-mono text-[var(--foreground-faint)]">
              #163847219
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ChainRow({
  row,
  prev,
  isAttest,
}: {
  row: Row;
  prev: string;
  isAttest: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={
        isAttest
          ? "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md bg-[var(--accent-soft)] px-2 py-1 -mx-2"
          : "flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
      }
    >
      <span className="text-[var(--foreground-faint)]">prev</span>
      <span className="text-[var(--foreground-muted)]">{prev}</span>
      <span className="text-[var(--foreground-faint)]">→</span>
      <span
        className={
          isAttest ? "text-[var(--accent-strong)]" : "text-[var(--foreground)]"
        }
      >
        {row.action}
      </span>
      <span className="text-[var(--foreground-faint)]">hash</span>
      <span
        className={
          isAttest ? "text-[var(--accent-strong)]" : "text-[var(--foreground)]"
        }
      >
        {row.hash}
      </span>
      {row.attest && (
        <span className="ml-auto rounded-sm border border-[var(--accent-strong)]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--accent-strong)]">
          {row.attest.backend}
        </span>
      )}
    </motion.div>
  );
}

function CursorRow() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[var(--foreground-faint)]">$</span>
      <motion.span
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1.1, repeat: Infinity }}
        className="inline-block h-[12px] w-[7px] bg-[var(--foreground-muted)]"
      />
    </div>
  );
}
