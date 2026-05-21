import Link from "next/link";

import {
  RekorArtefact,
  ToolLoopArtefact,
  VerifierArtefact,
} from "@/components/marketing/artefacts";
import { ChainVisual } from "@/components/marketing/chain-visual";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { TryDemoButton } from "@/components/marketing/try-demo-button";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import pkg from "../../package.json";

// Whether to render the "try the demo" CTA. True on Vercel where
// DEMO_VISITOR_ENABLED is set; false on the DigitalOcean paid surface
// (which is invite-only and shouldn't offer a public backdoor).
const SHOW_DEMO_CTA = process.env.DEMO_VISITOR_ENABLED === "true";

export const metadata = {
  title: "forenix/oss — court-admissible OSINT, from the first finding",
  description:
    "An open-source platform that bridges public-source leads to chain-of-custody evidence. SHA-256-chained audit log, real Git per case, twenty OSS tools, witnessed on Sigstore Rekor. MIT-licensed.",
};

/* ─────────────────────────────────────────────────────────────────
   The landing page is set as a single document. Preamble → §I–§V →
   footnotes. Drop cap on §I. Ornamental rules between sections.
   Marginalia in the desktop left-margin where a claim needs an
   aside. Footnote markers tie technical claims to a closing list.
   ────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <MarketingShell>
      <Preamble />
      <SectionI />
      <Ornament />
      <SectionII />
      <Ornament />
      <SectionIII />
      <Ornament />
      <SectionIV />
      <Ornament />
      <SectionV />
      <Footnotes />
    </MarketingShell>
  );
}

/* ─────────────────────────────  PREAMBLE  ────────────────────────
   The caption block of a published opinion. Case number top-left,
   stamp top-right, then the title and a one-line abstract. Two
   CTAs styled as a primary stamp (waitlist) + a ghost (live demo).
   ────────────────────────────────────────────────────────────────── */

function Preamble() {
  return (
    <section className="pt-12 pb-10 sm:pt-20">
      <div className="flex items-start justify-between gap-4">
        <div className="cd-smallcaps text-[12px]">
          In re: <span className="cd-mono not-italic">CASE-2026-014</span>
        </div>
        <span className="cd-stamp">sealed · v{pkg.version}</span>
      </div>

      <h1 className="mt-6 max-w-[18ch] text-balance font-[family-name:var(--font-display)] text-[48px] font-normal leading-[1.02] tracking-[-0.01em] text-[var(--fg-strong)] sm:text-[68px] md:text-[80px]">
        Court-admissible OSINT,
        <br className="hidden sm:block" />
        <span className="sm:hidden"> </span>
        from the <em className="italic text-[var(--accent)]">first finding</em>.
      </h1>

      <p className="mt-7 max-w-[42ch] font-[family-name:var(--font-body)] text-[18px] leading-[1.55] text-[var(--fg-muted)]">
        A claim about evidence is a claim about provenance. <em>forenix/oss</em>{" "}
        treats that obligation literally: every finding lands in a real Git
        case-repo, every state change appends to a SHA-256 forward-chained
        audit log, and the head of that chain is witnessed externally so it
        cannot be silently rewritten.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <Link href="/waitlist" className="cd-btn no-underline">
          join the waitlist
          <span aria-hidden>→</span>
        </Link>
        {SHOW_DEMO_CTA && <TryDemoButton />}
      </div>

      <hr className="mt-14 cd-rule" />
    </section>
  );
}

/* ─────────────────────────────  §I  ──────────────────────────────
   On the chain. Drop cap opens. Body sits in left-margin column on
   desktop with marginalia in the gutter. Exhibit A = the Python
   recipe.
   ────────────────────────────────────────────────────────────────── */

function SectionI() {
  return (
    <section id="i" className="pt-16 sm:pt-24">
      <div className="cd-margin-col">
        <aside className="cd-margin">
          <span className="cd-section__num">§ I.</span>{" "}
          <em>On the chain.</em>
          <br />
          <span className="cd-mono not-italic text-[11px]">art. 1.1–1.4</span>
        </aside>

        <div className="cd-prose">
          <h2 className="cd-section__title">A hash chain that survives a hostile DBA.</h2>

          <p className="cd-dropcap mt-7">
            Every state change <em>forenix</em> ever performs against a case
            appends a row to an audit log whose entries are linked by their
            SHA-256 hashes <span className="cd-fn">i</span>. The head of the
            chain commits not only to the latest action but to every action
            preceding it; a tampering attempt rewrites the head, but not the
            replay, and the discrepancy is detectable in a single pass.
          </p>

          <p>
            The verifier is, deliberately, twelve lines of Python. It does
            not depend on this codebase, on our schema, on our deployment.
            An auditor who suspects collusion can compute the chain from
            the bytes on disk and compare them to whatever head they have
            been given.
          </p>
        </div>
      </div>

      <Exhibit
        letter="A"
        label="the verifier"
        source="verify-chain.py · offline, no SDK"
      >
        <VerifierArtefact />
      </Exhibit>
    </section>
  );
}

/* ─────────────────────────────  §II  ─────────────────────────────
   On the witness. External attestation. Three backends. Exhibit B
   = the Rekor JSON.
   ────────────────────────────────────────────────────────────────── */

function SectionII() {
  return (
    <section id="ii" className="pt-12 sm:pt-20">
      <div className="cd-margin-col">
        <aside className="cd-margin">
          <span className="cd-section__num">§ II.</span>{" "}
          <em>On the witness.</em>
          <br />
          <span className="cd-mono not-italic text-[11px]">art. 2.1–2.5</span>
        </aside>

        <div className="cd-prose">
          <h2 className="cd-section__title">A second set of eyes, on someone else&apos;s clock.</h2>

          <p className="mt-7">
            The chain catches a DBA who edits rows. It does not catch a DBA
            who edits rows <em>and</em> re-derives the chain from genesis. To
            close that gap an external witness must publish, periodically,
            the head it observed at a given moment <span className="cd-fn">ii</span>.
          </p>

          <p>
            Three backends ship in this edition. The local backend keeps an
            HMAC archive under your own secret; the GitHub backend posts the
            head as an issue comment, dated by the platform; the Sigstore
            Rekor backend pins each head to the public transparency log. New
            witnesses arrive through a single adapter contract, which means a
            paranoid operator can run all three on different cadences and
            cross-check.
          </p>
        </div>
      </div>

      <Exhibit
        letter="B"
        label="exhibit b"
        source="rekor.sigstore.dev / api / v1 / log / entries / 24296fb…"
      >
        <RekorArtefact />
      </Exhibit>
    </section>
  );
}

/* ─────────────────────────────  §III  ────────────────────────────
   On the loop. The LLM tool-use side. Exhibit C = the typed tool
   trace.
   ────────────────────────────────────────────────────────────────── */

function SectionIII() {
  return (
    <section id="iii" className="pt-12 sm:pt-20">
      <div className="cd-margin-col">
        <aside className="cd-margin">
          <span className="cd-section__num">§ III.</span>{" "}
          <em>On the loop.</em>
          <br />
          <span className="cd-mono not-italic text-[11px]">art. 3.1–3.3</span>
        </aside>

        <div className="cd-prose">
          <h2 className="cd-section__title">Twenty open-source tools, one SAT-grounded loop.</h2>

          <p className="mt-7">
            The model does not fish for an answer. It picks tools from a
            typed registry, runs them, reads the output, and writes a
            structured trace using the analytic techniques described by
            Coulthart <span className="cd-fn">iii</span> and Heuer
            <span className="cd-fn">iv</span> — Key Assumptions Check, ACH,
            indicators &amp; warning, source-credibility evaluation.
          </p>

          <p>
            Bring your own key. Adapters ship for OpenRouter, Anthropic,
            Groq, GLM, NVIDIA, and Ollama. A <em>mock</em> adapter exists
            for tests and demos so the workflow never depends on a live
            credential to be exercised.
          </p>
        </div>
      </div>

      <Exhibit
        letter="C"
        label="exhibit c"
        source="tool-loop · run-2487 · openrouter / openai-gpt-oss-120b"
      >
        <ToolLoopArtefact />
      </Exhibit>
    </section>
  );
}

/* ─────────────────────────────  §IV  ─────────────────────────────
   The verifier — the pull-quote centerpiece. The live ChainVisual
   sits below it as the live evidentiary act.
   ────────────────────────────────────────────────────────────────── */

function SectionIV() {
  return (
    <section id="iv" className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-[40em] text-center">
        <span className="cd-section__num">§ IV.</span>
        <p className="cd-pull mt-4">
          &ldquo;Chain of custody&rdquo; is a <em>verb</em>, not a screenshot
          in a sales deck. If an auditor cannot replay the chain to genesis
          from the bytes on disk, you do not have one.
        </p>
        <p className="cd-smallcaps mt-6 text-[12px]">that is the bar we built to.</p>
      </div>

      <div className="mt-12 sm:mt-16">
        <Exhibit letter="D" label="live verification" source="$ forenix verify --case CASE-2026-014">
          <ChainVisual />
        </Exhibit>
      </div>
    </section>
  );
}

/* ─────────────────────────────  §V  ──────────────────────────────
   Of admission. Closing prose + the waitlist as an embedded
   application form.
   ────────────────────────────────────────────────────────────────── */

function SectionV() {
  return (
    <section id="v" className="pt-16 sm:pt-24">
      <div className="cd-margin-col">
        <aside className="cd-margin">
          <span className="cd-section__num">§ V.</span>{" "}
          <em>Of admission.</em>
          <br />
          <span className="cd-mono not-italic text-[11px]">art. 5.1</span>
        </aside>

        <div className="cd-prose">
          <h2 className="cd-section__title">Building <em>forenix/oss</em> in the open.</h2>

          <p className="mt-7">
            Invitations to the hosted edition go out in small batches to
            analysts, investigators, and security teams who would like to
            run the full workflow against a real case. Tell us a little
            about yours. The source is freely available, MIT-licensed, and
            self-hostable from the first commit.
          </p>
        </div>
      </div>

      <div className="mt-10 max-w-[42em]">
        <WaitlistForm variant="full" source="landing-final" surface="bare" />
      </div>
    </section>
  );
}

/* ─────────────────────────────  FOOTNOTES  ──────────────────────── */

function Footnotes() {
  return (
    <section className="pt-20 sm:pt-28">
      <hr className="cd-rule" />
      <div className="cd-smallcaps mt-6 text-[12px]">footnotes</div>
      <ol className="cd-fn-list">
        <li>
          The hash of every row is computed over the previous row&apos;s
          hash plus the row&apos;s own canonical payload, in field order.
          The verifier recipe is reproduced in Exhibit A.
        </li>
        <li>
          See: J. Buchanan et al., <em>External Witnessing for Append-Only
          Logs</em>, Sigstore design notes, 2023. The same model used by
          container-image transparency.
        </li>
        <li>
          R. J. Heuer Jr., <em>Psychology of Intelligence Analysis</em>,
          CIA Center for the Study of Intelligence, 1999.
        </li>
        <li>
          S. Coulthart, <em>Why Do Analysts Use Structured Analytic
          Techniques?</em>, Intelligence and National Security, 2016.
        </li>
      </ol>
    </section>
  );
}

/* ─────────────────────────────  HELPERS  ────────────────────────── */

function Ornament() {
  return (
    <div className="mt-14 sm:mt-20">
      <div className="cd-ornament">§</div>
    </div>
  );
}

function Exhibit({
  letter,
  label,
  source,
  children,
}: {
  letter: string;
  label: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="cd-exhibit">
      <figcaption className="cd-exhibit__cap">
        <span className="cd-exhibit__label">
          exhibit {letter} · {label}
        </span>
        <span className="cd-exhibit__source">{source}</span>
      </figcaption>
      <div className="cd-exhibit__art">{children}</div>
    </figure>
  );
}
