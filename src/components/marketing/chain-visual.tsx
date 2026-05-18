"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * Hero artefact: real `forenix verify` CLI output, typed out
 * line-by-line. The premise is "this is the actual thing the tool
 * does," not "here's an abstract chain visual." Less decoration,
 * more product.
 *
 * The lines below are the exact shape of what
 * `bun run scripts/verify-chain.ts` emits against a seeded DB —
 * abbreviated for the marketing surface. No randomisation, SSR-safe.
 */

interface Line {
  // null prefix = silent (no command echo)
  prompt?: "$" | "→";
  body: string;
  tone?: "muted" | "ok" | "warn" | "accent";
  // Optional pause AFTER this line lands, in ms. Default 240.
  pause?: number;
}

const LINES: Line[] = [
  { prompt: "$", body: "forenix verify --case CASE-2026-014" },
  { body: "loading chain ............................. 412 rows", tone: "muted", pause: 380 },
  { body: "replaying SHA-256 forward link ............. ok",       tone: "muted" },
  { body: "verifying evidence content addresses ...... ok",        tone: "muted" },
  { body: "checking case-git branch heads ............. ok",       tone: "muted" },
  { body: "external attestations:",                                tone: "muted", pause: 200 },
  { body: "  · local    (HMAC, AUTH_SECRET) ........... ok",       tone: "muted" },
  { body: "  · github   (issue #14, comment 218477) ... ok",       tone: "muted" },
  { body: "  · rekor    (logIndex 163847219) .......... ok",       tone: "accent", pause: 360 },
  { body: "" },
  { body: "chain OK — 412 rows, 3 witnesses agree.",               tone: "ok",     pause: 0 },
];

export function ChainVisual() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= LINES.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), LINES[step]?.pause ?? 240);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="relative w-full">
      {/* a tiny editorial label sitting OFF the top-left of the card */}
      <span
        className="absolute -top-2 left-3 z-10 select-none rounded-sm border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-[var(--foreground-muted)] uppercase"
        aria-hidden
      >
        verify.sh
      </span>

      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[#0b0d10] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.85),0_0_0_1px_color-mix(in_oklch,var(--accent-strong)_15%,transparent)]">
        {/* chrome */}
        <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-[10px] text-white/40">~/cases/case-2026-014</span>
          <span className="font-mono text-[10px] text-white/30">bash</span>
        </div>

        <div className="space-y-[2px] overflow-x-auto p-3 font-mono text-[11px] leading-[1.55] text-white/85 sm:p-4 sm:text-[12px]">
          {LINES.slice(0, step).map((line, idx) => (
            <Row key={idx} line={line} />
          ))}
          {step < LINES.length && (
            <div className="flex items-baseline gap-2 pt-0.5">
              {step === 0 && <span className="text-white/30">$</span>}
              <motion.span
                animate={{ opacity: [1, 0.15, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className="inline-block h-[13px] w-[7px] bg-white/60"
              />
            </div>
          )}
        </div>
      </div>

      {/* slightly off-grid hand-drawn annotation */}
      {step >= LINES.length && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="absolute -bottom-7 right-1 flex items-center gap-1 text-[10px] italic text-[var(--accent-strong)]"
          style={{ transform: "rotate(-1.5deg)" }}
        >
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M2 8 C 10 1, 18 1, 24 7" />
            <path d="M21 4 L 24 7 L 21 9" />
          </svg>
          <span>three independent witnesses agree</span>
        </motion.div>
      )}
    </div>
  );
}

function Row({ line }: { line: Line }) {
  const colour =
    line.tone === "ok"
      ? "text-emerald-300"
      : line.tone === "accent"
      ? "text-[var(--accent-strong)]"
      : line.tone === "warn"
      ? "text-amber-300"
      : line.tone === "muted"
      ? "text-white/55"
      : "text-white/85";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="flex items-baseline gap-2 whitespace-pre"
    >
      {line.prompt && <span className="text-white/30">{line.prompt}</span>}
      <span className={colour}>{line.body}</span>
    </motion.div>
  );
}
