import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Hash,
  ShieldCheck,
  Stamp,
  Wrench,
  Database,
  FileSignature,
  Sparkles,
} from "lucide-react";

import { ChainVisual } from "@/components/marketing/chain-visual";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const metadata = {
  title: "forenix-oss — OSINT × forensics with an attested chain of custody",
  description:
    "Open-source platform that bridges public-source leads to chain-of-custody evidence. SHA-256 audit chain, real Git per case, 20 OSS OSINT tools, witnessed on Sigstore Rekor.",
};

export default function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <TrustStrip />
      <FeatureGrid />
      <HowItWorks />
      <ChainSection />
      <StackStrip />
      <FinalCTA />
    </MarketingShell>
  );
}

/* ─────────────────────────────  Hero  ───────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-16 sm:pt-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <a
            href="https://github.com/thunderstornX/forenix-oss/releases/tag/v0.4.0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-strong)]/30 bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-medium text-[var(--accent-strong)] hover:border-[var(--accent-strong)]/60"
          >
            <Sparkles className="h-3 w-3" />
            v0.4.0 — external attestation is live
            <ArrowRight className="h-3 w-3" />
          </a>
          <h1 className="mt-5 text-balance text-[34px] font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-[44px] lg:text-[52px]">
            Forensic-grade OSINT,{" "}
            <span className="text-[var(--accent-strong)]">cryptographically attested.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--foreground-muted)] sm:text-[16px]">
            Bridge public-source leads to chain-of-custody evidence in one workflow.
            SHA-256-chained audit log, real Git per case, 20 OSS OSINT tools, and a
            chain head witnessed on Sigstore Rekor — so even a DB admin can&apos;t
            rewrite history without leaving a trace.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/waitlist"
              className="group inline-flex items-center gap-2 rounded-md bg-[var(--accent-strong)] px-5 py-2.5 text-[14px] font-medium text-black transition hover:brightness-110"
            >
              Join the waitlist
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://demo.forenix.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border-strong)] bg-transparent px-5 py-2.5 text-[14px] font-medium text-[var(--foreground)] hover:bg-[var(--background-elev)]"
            >
              View live demo
            </a>
          </div>
          <p className="mt-5 text-[12px] text-[var(--foreground-muted)]">
            MIT licensed · Self-hostable · No vendor lock-in
          </p>
        </div>

        <div className="relative">
          <ChainVisual />
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────  Trust strip  ──────────────────────── */

function TrustStrip() {
  const items = [
    "MIT licensed",
    "SHA-256 forward-chained",
    "Sigstore-attested",
    "20 OSINT tools",
    "7 LLM adapters",
    "Self-hostable",
  ];
  return (
    <section className="relative mt-20 border-y border-[var(--border)]/60 bg-[var(--background-elev)]/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-4 text-[11px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] sm:px-6">
        {items.map((t, i) => (
          <span key={t} className="flex items-center gap-2">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-[var(--foreground-faint)]" />}
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────  Feature grid  ──────────────────────── */

function FeatureGrid() {
  const features = [
    {
      icon: Hash,
      title: "Hash-chained audit log",
      body: "Every state change is SHA-256 linked to the previous one. Replay in 12 lines of Python; tampering is irreversible without re-signing from genesis.",
    },
    {
      icon: GitBranch,
      title: "Real Git per case",
      body: "isomorphic-git per case on persistent disk. Independently cloneable, branchable, and reviewable — not a database column pretending to be Git.",
    },
    {
      icon: Stamp,
      title: "External attestation",
      body: "Pin the chain head to Sigstore Rekor, a GitHub-issue comment, or an HMAC archive. Three backends, one adapter contract, more drop in without schema change.",
      badge: "v0.4.0",
    },
    {
      icon: Wrench,
      title: "LLM tool-use loop",
      body: "20 OSS OSINT tools wired into a SAT-grounded tool-use loop. Bring your own key for OpenRouter / Claude / Groq / GLM / NVIDIA / Ollama / mock.",
    },
    {
      icon: Database,
      title: "Content-addressed evidence",
      body: "Real bytes streamed to disk through a SHA-256 hash. Dedup per case, byte-level verify, 500 MB cap — no theatrical 'file = JSON blob' nonsense.",
    },
    {
      icon: FileSignature,
      title: "Admissible PDF report",
      body: "Per-case forensic report renders the chain-of-custody attestation block, evidence inventory, finding summaries, and a sample of the audit log.",
    },
  ];
  return (
    <section id="features" className="relative mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <SectionHeader
        eyebrow="What ships in the box"
        title="A forensic substrate, not a vendor demo."
        sub="Every primitive is open source, swappable, and offline-verifiable. We measure success in things you can hand to an auditor, not screenshots."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  badge,
}: {
  icon: typeof Hash;
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <div className="group relative rounded-xl border border-[var(--border)] bg-[var(--background-elev)]/40 p-5 transition hover:border-[var(--accent-strong)]/40 hover:bg-[var(--background-elev)]/70">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--accent-strong)]/30 bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Icon className="h-4 w-4" />
        </div>
        {badge && (
          <span className="rounded-full border border-[var(--accent-strong)]/40 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--accent-strong)]">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
        {body}
      </p>
    </div>
  );
}

/* ─────────────────────────  How it works  ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Lead",
      body: "Spin up an investigation against a target. The LLM tool-use loop picks the right OSS recon tools and runs them with SAT-grounded prompting — Key Assumptions Check, ACH matrix, credibility scoring.",
    },
    {
      n: "02",
      title: "Promote",
      body: "Promote a finding to evidence and the case Git grows a branch. Real bytes are streamed to a content-addressed store; the audit log appends a new hash-linked row.",
    },
    {
      n: "03",
      title: "Attest",
      body: "Periodically pin the chain's head hash to an external witness — Sigstore Rekor by default. The attestation event is itself audited, so the witness history is tamper-evident.",
    },
  ];
  return (
    <section id="how" className="relative mx-auto mt-28 max-w-6xl px-4 sm:px-6">
      <SectionHeader
        eyebrow="How it flows"
        title="From public-source lead to attested evidence."
        sub="One workflow, three substrates. No copying-out, no chain-of-custody hand-wave."
      />
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-elev)]/40 p-6"
          >
            <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--accent-strong)]">
              {s.n}
            </span>
            <h3 className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
              {s.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────  Verify-the-chain snippet  ───────────────── */

function ChainSection() {
  return (
    <section id="chain" className="relative mx-auto mt-28 max-w-6xl px-4 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <SectionHeader
            eyebrow="Offline-verifiable"
            title="Twelve lines of Python prove the chain."
            sub="Hand someone a CSV dump of the audit log and this recipe. They walk the rows, recompute every hash, and stop at the first mismatch. No SDK, no service, no trust."
            align="left"
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background-elev)]/60 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
              verify-chain.py
            </span>
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-[1.6] text-[var(--foreground)]">
{`import csv, hashlib

GENESIS = "0" * 64
prev = GENESIS

with open("audit.csv") as f:
    for r in csv.DictReader(f):
        payload = "|".join([prev, r["action"], r["entity"],
                            r["entityId"], r["createdAt"]])
        h = hashlib.sha256(payload.encode()).hexdigest()
        assert r["prevHash"] == prev and r["hash"] == h, f"BROKEN at {r['id']}"
        prev = r["hash"]

print("chain OK")`}
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────  Stack  ──────────────────────────── */

function StackStrip() {
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
    <section className="relative mx-auto mt-28 max-w-6xl px-4 sm:px-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background-elev)]/40 p-6">
        <div className="text-center text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
          Built on
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px] font-medium text-[var(--foreground)]">
          {stack.map((s, i) => (
            <span key={s} className="flex items-center gap-3">
              {i > 0 && (
                <span className="h-1 w-1 rounded-full bg-[var(--foreground-faint)]" />
              )}
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────  Final CTA  ──────────────────────── */

function FinalCTA() {
  return (
    <section className="relative mx-auto mt-28 max-w-3xl px-4 text-center sm:px-6">
      <h2 className="text-balance text-[28px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[34px]">
        Building forenix-oss in the open.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--foreground-muted)]">
        Invites go out in small batches to analysts, investigators, and security teams who
        want to try the full workflow against a real case. Tell us a bit about yourself
        and we&apos;ll get you in.
      </p>
      <div className="mx-auto mt-8 max-w-lg text-left">
        <WaitlistForm variant="full" source="landing-final-cta" />
      </div>
    </section>
  );
}

/* ─────────────────────────  Small helpers  ─────────────────────── */

function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  sub: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-balance text-[26px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[32px]">
        {title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--foreground-muted)]">
        {sub}
      </p>
    </div>
  );
}
