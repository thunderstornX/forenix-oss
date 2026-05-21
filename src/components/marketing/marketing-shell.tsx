"use client";

import Link from "next/link";

import { version as pkgVersion } from "../../../package.json";

/**
 * Marketing surface chrome.
 *
 * The Court Document direction treats the landing page as a single
 * printed legal/scholarly document. The chrome reads accordingly:
 *
 *   ── Document masthead: serif wordmark + section directory + version
 *   ── A double rule under the masthead, the way a published opinion
 *      sits beneath its caption
 *   ── A faint margin rule down the left edge of the page (desktop),
 *      the way a printed page has a binding gutter
 *   ── Colophon footer: edition info, author, set in the same register
 *      as the document itself
 *
 * No SaaS-y backdrop blur, no aurora beam, no pill nav. Everything
 * the user sees should reinforce "this is a document, read it."
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cd-doc relative min-h-screen bg-[var(--bg)]">
      <Masthead />
      <main className="relative mx-auto max-w-[1080px] px-5 sm:px-8 lg:px-14">
        <span aria-hidden className="cd-margin-rule" />
        {children}
      </main>
      <Colophon />
    </div>
  );
}

/* ─────────────────────────  MASTHEAD  ───────────────────────────── */

function Masthead() {
  return (
    <header className="relative">
      {/* a hair-thin top stripe gives the page a "printed top edge" */}
      <div className="h-[3px] w-full bg-[var(--accent)]" />
      <div className="mx-auto flex max-w-[1080px] flex-col gap-3 px-5 pt-7 pb-5 sm:px-8 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:px-14">
        {/* Wordmark — serif display, italic slash, all single weight */}
        <div>
          <Link
            href="/"
            className="block font-[family-name:var(--font-display)] text-[34px] leading-none tracking-tight text-[var(--fg-strong)] no-underline"
            style={{ textDecoration: "none" }}
          >
            forenix
            <span className="italic text-[var(--accent)]">/</span>
            oss
          </Link>
          <div className="mt-1.5 cd-smallcaps text-[11px]">
            an open-source instrument of evidence
          </div>
        </div>

        {/* Section directory + version — reads like a published opinion's
            caption block. Section anchors map to §§ in the page. */}
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 font-[family-name:var(--font-body)] text-[14px] italic text-[var(--fg-muted)]">
            <a href="#i"   className="no-underline hover:text-[var(--fg-strong)]">§I Chain</a>
            <a href="#ii"  className="no-underline hover:text-[var(--fg-strong)]">§II Witness</a>
            <a href="#iii" className="no-underline hover:text-[var(--fg-strong)]">§III Loop</a>
            <a href="#iv"  className="no-underline hover:text-[var(--fg-strong)]">§IV Verifier</a>
            <a href="#v"   className="no-underline hover:text-[var(--fg-strong)]">§V Admission</a>
          </nav>
          <div className="flex items-baseline gap-3 font-mono text-[11px] text-[var(--fg-muted)]">
            <span>Vol. 0 · Ed. {pkgVersion.split(".")[1]} · v{pkgVersion}</span>
            <span aria-hidden className="text-[var(--fg-faint)]">·</span>
            <a
              href="https://github.com/thunderstornX/forenix-oss"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:text-[var(--fg-strong)]"
            >
              source ↗
            </a>
            <Link href="/sign-in" className="no-underline hover:text-[var(--fg-strong)]">
              sign in
            </Link>
          </div>
        </div>
      </div>
      {/* double rule under the masthead — the document begins here */}
      <div className="mx-auto max-w-[1080px] px-5 sm:px-8 lg:px-14">
        <hr className="cd-rule--double" />
      </div>
    </header>
  );
}

/* ─────────────────────────  COLOPHON  ────────────────────────────── */

function Colophon() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-28 sm:mt-40">
      <div className="mx-auto max-w-[1080px] px-5 sm:px-8 lg:px-14 pb-16">
        <hr className="cd-rule--double" />
        <div className="mt-10 grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          {/* Colophon prose — the way a printed edition closes */}
          <div className="cd-prose max-w-none">
            <div className="cd-smallcaps text-[12px]">colophon</div>
            <p className="mt-3 font-[family-name:var(--font-body)] text-[15px] leading-[1.6] text-[var(--fg-muted)]">
              Set in <em>Newsreader</em> and <em>Instrument Serif</em>,
              with <span className="cd-mono">JetBrains Mono</span> for
              the technical bench-work. Bound on Next.js, Prisma, and
              Bun. Released under the MIT licence in the open at{" "}
              <a
                href="https://github.com/thunderstornX/forenix-oss"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/thunderstornX/forenix-oss
              </a>
              . No telemetry, no upsells.
            </p>
          </div>

          {/* Edition info — short numbered set */}
          <dl className="cd-set">
            <dt>Edition</dt>
            <dd>v{pkgVersion} · 2026</dd>
            <dt>Licence</dt>
            <dd>MIT</dd>
            <dt>Maintainer</dt>
            <dd>
              <a
                href="https://github.com/thunderstornX"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline hover:underline"
              >
                AMB
              </a>
            </dd>
            <dt>ORCID</dt>
            <dd>0009-0007-2787-943X</dd>
          </dl>

          {/* Links — secondary, document-toned */}
          <div className="flex flex-col gap-2 font-[family-name:var(--font-body)] text-[14px] italic text-[var(--fg-muted)]">
            <a
              href="https://demo.forenix.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:text-[var(--fg-strong)]"
            >
              the live demo →
            </a>
            <a
              href="https://github.com/thunderstornX/forenix-oss/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:text-[var(--fg-strong)]"
            >
              releases →
            </a>
            <Link href="/waitlist" className="no-underline hover:text-[var(--fg-strong)]">
              join the waitlist →
            </Link>
            <Link href="/sign-in" className="no-underline hover:text-[var(--fg-strong)]">
              sign in →
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-[var(--fg-faint)]">
          <span>© {year} · forenix/oss</span>
          <span aria-hidden>— end of document —</span>
        </div>
      </div>
    </footer>
  );
}
