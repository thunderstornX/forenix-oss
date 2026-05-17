"use client";

import Link from "next/link";

/**
 * Marketing chrome — kept deliberately quiet so the page content
 * carries the weight. The previous version had an aurora-glow +
 * dotted-grid backdrop on every page; that read as a SaaS template.
 * This one drops both in favour of a single, off-axis beam that
 * sits behind the hero and fades out before the rest of the page,
 * plus very fine grain noise.
 */

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <BackgroundLayer />
      <MarketingNav />
      <main className="relative">{children}</main>
      <MarketingFooter />
    </div>
  );
}

function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 bg-[var(--background)]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-[14px] font-medium tracking-tight">
          <Glyph />
          <span className="font-[family-name:var(--font-sans)]">
            forenix<span className="text-[var(--accent-strong)]">/</span>oss
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-[var(--foreground-muted)] md:flex">
          <a href="#chain"    className="transition hover:text-[var(--foreground)]">Chain</a>
          <a href="#how"      className="transition hover:text-[var(--foreground)]">How it works</a>
          <a href="#verify"   className="transition hover:text-[var(--foreground)]">Verify</a>
          <a
            href="https://github.com/thunderstornX/forenix-oss"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-[var(--foreground)]"
          >
            Source
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-md px-2.5 py-1.5 text-[13px] text-[var(--foreground-muted)] transition hover:text-[var(--foreground)] sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/waitlist"
            className="inline-flex items-center gap-1 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-[13px] font-medium text-[var(--background)] transition hover:bg-[var(--foreground)]/90"
          >
            Join waitlist
            <span aria-hidden className="ml-0.5">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="relative mt-32">
      <div className="mx-auto max-w-6xl px-5 pb-12">
        {/* hairline rule with a single annotation, not a full border */}
        <div className="relative">
          <div className="h-px w-full bg-[var(--border)]" />
          <span className="absolute -top-2 left-0 bg-[var(--background)] pr-3 font-mono text-[10px] tracking-[0.18em] text-[var(--foreground-muted)] uppercase">
            ── ./eof
          </span>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-md">
            <Link href="/" className="flex items-center gap-2 text-[14px] font-medium">
              <Glyph />
              <span>forenix<span className="text-[var(--accent-strong)]">/</span>oss</span>
            </Link>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--foreground-muted)]">
              Built in the open by{" "}
              <a
                href="https://github.com/thunderstornX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--foreground)] underline-offset-2 hover:underline"
              >
                Ali Murtaza Bhutto
              </a>
              . MIT-licensed. No telemetry. No upsells.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[var(--foreground-muted)]">
            <a href="https://demo.forenix.tech" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
              Live demo
            </a>
            <a href="https://github.com/thunderstornX/forenix-oss" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
              GitHub
            </a>
            <a href="https://github.com/thunderstornX/forenix-oss/releases" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
              Releases
            </a>
            <Link href="/waitlist" className="hover:text-[var(--foreground)]">Waitlist</Link>
          </div>
        </div>

        <div className="mt-6 font-mono text-[10px] text-[var(--foreground-faint)]">
          © {new Date().getFullYear()} · v0.4.0
        </div>
      </div>
    </footer>
  );
}

function Glyph() {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-strong)]/12 text-[var(--accent-strong)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </span>
  );
}

function BackgroundLayer() {
  // One off-axis beam tucked above the hero, plus a hairline grain
  // texture. Both fade out before the page content past the hero, so
  // the marketing surface doesn't feel like every-other-SaaS.
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[900px] overflow-hidden" aria-hidden>
      {/* off-axis amber beam — single source, low opacity */}
      <div
        className="absolute -top-32 left-1/2 h-[700px] w-[1200px] -translate-x-1/2 rotate-[-6deg] opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 35% 30%, color-mix(in oklch, var(--accent-strong) 22%, transparent), transparent 65%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
        }}
      />
      {/* hairline grain — subtle but signals "hand-made" */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
