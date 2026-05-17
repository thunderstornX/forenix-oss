import Link from "next/link";

import {
  RekorArtefact,
  ToolLoopArtefact,
  VerifierArtefact,
} from "@/components/marketing/artefacts";
import { ChainVisual } from "@/components/marketing/chain-visual";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const metadata = {
  title: "forenix/oss — court-admissible OSINT, from the first finding",
  description:
    "Open-source platform that bridges public-source leads to chain-of-custody evidence. SHA-256-chained audit log, real Git per case, 20 OSS OSINT tools, witnessed on Sigstore Rekor. MIT licensed.",
};

export default function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <Capabilities />
      <ChainShelf />
      <ToolsShelf />
      <AttestShelf />
      <VerifyMoment />
      <StackLine />
      <FinalInvite />
    </MarketingShell>
  );
}

/* ──────────────────────────  HERO  ─────────────────────────────
   Asymmetric editorial split. Serif display H1 with mid-sentence
   italic, mono lowercase verb-stack underneath, two CTAs, real
   CLI artefact on the right. No "v0.4.0 NEW" eyebrow chip — it'd
   compete with the headline.
   ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-16 sm:pt-24">
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <h1 className="text-balance font-[family-name:var(--font-display)] text-[44px] font-normal leading-[1.05] tracking-[-0.02em] text-[var(--foreground)] sm:text-[60px] lg:text-[72px]">
            Court-admissible OSINT,
            <br />
            from the{" "}
            <span className="italic text-[var(--accent-strong)]">first finding</span>.
          </h1>

          <p className="mt-7 max-w-xl font-mono text-[13px] leading-relaxed text-[var(--foreground-muted)] sm:text-[14px]">
            <span className="text-[var(--foreground)]">collect.</span>{" "}
            <span className="text-[var(--foreground)]">correlate.</span>{" "}
            <span className="text-[var(--foreground)]">attest.</span>
            <br />
            one workflow, one git-style case repo, one offline-verifiable chain of custody.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/waitlist"
              className="group inline-flex items-center gap-2 rounded-md bg-[var(--accent-strong)] px-5 py-2.5 text-[14px] font-medium text-black transition hover:brightness-110"
            >
              Join the waitlist
              <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="https://demo.forenix.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-[var(--background-elev)]/60"
            >
              try the live demo
              <span aria-hidden className="text-[var(--foreground-muted)]">↗</span>
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
            <Pill>MIT licensed</Pill>
            <Pill>SHA-256 chained</Pill>
            <Pill>Sigstore-attested</Pill>
            <Pill>20 OSS tools</Pill>
            <Pill>Self-hostable</Pill>
          </ul>
        </div>

        <div className="lg:col-span-5">
          {/* Slight rotation so it doesn't feel grid-perfect */}
          <div className="lg:mt-4" style={{ transform: "rotate(0.35deg)" }}>
            <ChainVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-[3px] w-[3px] rounded-full bg-[var(--accent-strong)]" />
      {children}
    </li>
  );
}

/* ─────────────────────  CAPABILITIES (lowercase verb-stack)  ────
   Big lowercase numerals + verbs, no cards, broken baseline.
   ──────────────────────────────────────────────────────────────── */

function Capabilities() {
  const items = [
    {
      n: "01",
      verb: "collect",
      body: "Wire any of 20 OSS reconnaissance tools — sherlock, subfinder, theHarvester, exiftool, the ProjectDiscovery suite — behind a SAT-grounded LLM tool-use loop that picks the right one for the task.",
    },
    {
      n: "02",
      verb: "correlate",
      body: "Promote findings into evidence; the case grows a real git branch. Entities cross-link automatically. Every state change appends to a SHA-256 forward-chained audit log.",
    },
    {
      n: "03",
      verb: "attest",
      body: "Pin the chain head to an external witness — Sigstore Rekor, a GitHub-issue comment, or a local HMAC archive — so even a DB admin can't silently rewrite history.",
    },
  ];
  return (
    <section id="how" className="relative mx-auto mt-32 max-w-6xl px-5">
      <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
        {items.map((it, i) => (
          <div key={it.n} className={i === 1 ? "lg:mt-8" : i === 2 ? "lg:mt-4" : ""}>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--foreground-faint)]">
                {it.n}
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-[36px] font-normal italic leading-none text-[var(--foreground)]">
                {it.verb}.
              </h3>
            </div>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--foreground-muted)]">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────  FEATURE SHELVES  ────────────────────────
   Horizontal staggered rows (Vercel-style) — copy on one side,
   real product artefact on the other. Alternating sides keeps the
   page feeling editorial, not gridded.
   ──────────────────────────────────────────────────────────────── */

function ChainShelf() {
  return (
    <Shelf
      id="chain"
      eyebrow="The chain"
      title="A hash chain that survives a hostile DBA."
      body="Every state change appends a SHA-256 row that forward-links to the previous one. Tampering is detectable in a single replay, and a 12-line Python recipe reproduces the verifier exactly — no SDK required to prove the chain is intact."
      side="left"
      art={<VerifierArtefact />}
    />
  );
}

function ToolsShelf() {
  return (
    <Shelf
      eyebrow="The pipeline"
      title="20 OSS tools, one SAT-grounded loop."
      body="The LLM doesn't fish for an answer — it picks tools from a typed registry, runs them, reads the output, and writes a structured trace using Coulthart/Heuer structured analytic techniques. Bring your own key for OpenRouter, Claude, Groq, GLM, NVIDIA, Ollama, or run mock."
      side="right"
      art={<ToolLoopArtefact />}
    />
  );
}

function AttestShelf() {
  return (
    <Shelf
      eyebrow="The witness"
      title="External attestation, in three flavours."
      body="The chain alone catches DB tampering — but only if no one re-signed it from genesis. Pin the head to an external witness on a cadence and that gap closes. Three backends ship in v0.4.0, more drop in through one adapter contract."
      side="left"
      art={<RekorArtefact />}
      newBadge="v0.4.0"
    />
  );
}

function Shelf({
  id,
  eyebrow,
  title,
  body,
  side,
  art,
  newBadge,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  side: "left" | "right";
  art: React.ReactNode;
  newBadge?: string;
}) {
  return (
    <section id={id} className="relative mx-auto mt-32 max-w-6xl px-5">
      <div
        className={
          side === "left"
            ? "grid items-center gap-10 lg:grid-cols-[1.05fr_1.2fr]"
            : "grid items-center gap-10 lg:grid-cols-[1.2fr_1.05fr]"
        }
      >
        {side === "left" ? (
          <>
            <ShelfText eyebrow={eyebrow} title={title} body={body} newBadge={newBadge} />
            <div>{art}</div>
          </>
        ) : (
          <>
            <div className="order-2 lg:order-1">{art}</div>
            <div className="order-1 lg:order-2">
              <ShelfText eyebrow={eyebrow} title={title} body={body} newBadge={newBadge} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ShelfText({
  eyebrow,
  title,
  body,
  newBadge,
}: {
  eyebrow: string;
  title: string;
  body: string;
  newBadge?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">
          {eyebrow}
        </span>
        {newBadge && (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {newBadge}
          </span>
        )}
      </div>
      <h2 className="mt-3 max-w-md text-balance font-[family-name:var(--font-display)] text-[34px] font-normal leading-[1.1] tracking-[-0.01em] text-[var(--foreground)] sm:text-[40px]">
        {title}
      </h2>
      <p className="mt-5 max-w-md text-[14px] leading-relaxed text-[var(--foreground-muted)]">
        {body}
      </p>
    </div>
  );
}

/* ─────────────────────  THE VERIFY MOMENT (off-grid)  ──────────
   The deliberate hand-set fingerprint. Slight rotation, hand-drawn
   arrow, italics. Reads "human shipped this", not "template".
   ──────────────────────────────────────────────────────────────── */

function VerifyMoment() {
  return (
    <section id="verify" className="relative mx-auto mt-40 max-w-3xl px-5 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">
        ↳ the part most platforms hand-wave
      </span>
      <p className="mt-5 font-[family-name:var(--font-display)] text-balance text-[28px] font-normal leading-[1.25] text-[var(--foreground)] sm:text-[36px]">
        “Chain of custody” is a{" "}
        <span className="italic text-[var(--accent-strong)]">verb</span>, not a screenshot in
        a sales deck. If an auditor can&apos;t replay the chain to genesis from the bytes
        on disk, you don&apos;t have one.
      </p>
      <p className="mt-6 font-mono text-[12px] text-[var(--foreground-muted)]">
        — that&apos;s the bar we built to.
      </p>
    </section>
  );
}

/* ─────────────────────  STACK LINE  ─────────────────────────────
   Single editorial line, no card, no logos. Mono. Honest.
   ──────────────────────────────────────────────────────────────── */

function StackLine() {
  const stack = [
    "Next.js 16",
    "TypeScript strict",
    "Tailwind 4",
    "Prisma 6",
    "Bun",
    "isomorphic-git",
    "Sigstore Rekor",
    "OpenRouter",
    "ProjectDiscovery",
  ];
  return (
    <section className="relative mx-auto mt-32 max-w-5xl px-5">
      <div className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--foreground-faint)]">
        built on
      </div>
      <p className="mt-3 text-center text-[14px] text-[var(--foreground-muted)]">
        {stack.map((s, i) => (
          <span key={s}>
            <span className="text-[var(--foreground)]">{s}</span>
            {i < stack.length - 1 && (
              <span className="px-3 text-[var(--foreground-faint)]">·</span>
            )}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ─────────────────────  FINAL INVITE  ──────────────────────────
   Editorial, not corporate. Serif headline, embedded form.
   ──────────────────────────────────────────────────────────────── */

function FinalInvite() {
  return (
    <section className="relative mx-auto mt-32 max-w-2xl px-5 text-center">
      <h2 className="text-balance font-[family-name:var(--font-display)] text-[36px] font-normal leading-[1.1] text-[var(--foreground)] sm:text-[44px]">
        Building <span className="italic text-[var(--accent-strong)]">forenix/oss</span> in
        the open.
      </h2>
      <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-[var(--foreground-muted)]">
        Invites go out in small batches to analysts, investigators, and security teams
        who&apos;d like to run the full workflow against a real case. Tell us a little
        about yours.
      </p>
      <div className="mx-auto mt-8 max-w-lg text-left">
        <WaitlistForm variant="full" source="landing-final" surface="bare" />
      </div>
    </section>
  );
}
