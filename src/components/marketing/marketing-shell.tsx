"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Shared chrome for the public marketing pages — top nav + footer.
 * The authed app at /app has its own shell (sidebar + topbar); these
 * are intentionally separate so the marketing surface stays light.
 */

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <BackgroundAura />
      <MarketingNav />
      <main className="relative">{children}</main>
      <MarketingFooter />
    </div>
  );
}

function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)]/60 bg-[var(--background)]/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <Glyph />
          <span>forenix<span className="text-[var(--accent-strong)]">-oss</span></span>
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] text-[var(--foreground-muted)] md:flex">
          <a href="#features" className="hover:text-[var(--foreground)]">Features</a>
          <a href="#how" className="hover:text-[var(--foreground)]">How it works</a>
          <a href="#chain" className="hover:text-[var(--foreground)]">Verify</a>
          <a
            href="https://github.com/thunderstornX/forenix-oss"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--foreground)]"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden sm:inline-flex rounded-md px-3 py-1.5 text-[13px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            Sign in
          </Link>
          <Link
            href="/waitlist"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--accent-strong)]/40 bg-[var(--accent-soft)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-strong)] hover:brightness-110"
          >
            Join waitlist
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="relative mt-24 border-t border-[var(--border)]/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold">
            <Glyph />
            <span>forenix<span className="text-[var(--accent-strong)]">-oss</span></span>
          </Link>
          <p className="mt-3 max-w-sm text-[12px] text-[var(--foreground-muted)]">
            Open-source platform that fuses OSINT investigations with Git-style forensic
            case management. Built by Ali Murtaza Bhutto. MIT-licensed.
          </p>
        </div>
        <FooterCol
          heading="Product"
          links={[
            { label: "Features", href: "#features" },
            { label: "How it works", href: "#how" },
            { label: "Live demo", href: "https://demo.forenix.tech" },
            { label: "Concept demo", href: "https://forenix.tech" },
          ]}
        />
        <FooterCol
          heading="Code"
          links={[
            { label: "GitHub", href: "https://github.com/thunderstornX/forenix-oss" },
            { label: "Releases", href: "https://github.com/thunderstornX/forenix-oss/releases" },
            { label: "Security", href: "https://github.com/thunderstornX/forenix-oss/blob/main/SECURITY.md" },
            { label: "License (MIT)", href: "https://github.com/thunderstornX/forenix-oss/blob/main/LICENSE" },
          ]}
        />
      </div>
      <div className="border-t border-[var(--border)]/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] text-[var(--foreground-muted)] sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Ali Murtaza Bhutto. MIT licensed.</span>
          <a
            href="https://github.com/thunderstornX/forenix-oss"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)]"
          >
            <svg
              aria-hidden
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.04c-3.2.7-3.87-1.36-3.87-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.07.78 2.16v3.2c0 .31.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
            </svg>
            thunderstornX/forenix-oss
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {heading}
      </div>
      <ul className="mt-3 space-y-2 text-[12px]">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              {...(l.href.startsWith("http")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Glyph() {
  // Small chain-link mark — references the hash-chain primitive.
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--accent-strong)]/50 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </span>
  );
}

function BackgroundAura() {
  // Aurora amber glow + dotted grid — fixed so it follows scroll
  // through the marketing pages without bleeding into the app.
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* radial aurora */}
      <div
        className="absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--accent-strong) 30%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute top-[40%] right-[-200px] h-[400px] w-[600px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--accent-strong) 22%, transparent), transparent 70%)",
        }}
      />
      {/* dotted grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--foreground-faint) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 85%)",
        }}
      />
    </div>
  );
}
