import Link from "next/link";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const metadata = {
  title: "Petition for entry — forenix/oss",
  description:
    "Apply for the hosted edition of forenix-oss. Invites go out in small batches to analysts, investigators, and security teams who want to run the full workflow against a real case.",
};

export default function WaitlistPage() {
  return (
    <MarketingShell>
      <section className="pt-12 pb-16 sm:pt-20">
        <div className="flex items-baseline justify-between gap-4">
          <Link
            href="/"
            className="cd-smallcaps text-[12px] no-underline hover:text-[var(--fg-strong)]"
          >
            ← return to the document
          </Link>
          <span className="cd-smallcaps text-[12px]">art. 5.1</span>
        </div>

        <div className="mt-10 cd-margin-col">
          <aside className="cd-margin">
            <span className="cd-section__num">§ V.</span>{" "}
            <em>Of admission.</em>
            <br />
            <span className="cd-mono not-italic text-[11px]">art. 5.1</span>
          </aside>

          <div className="cd-prose">
            <h1 className="cd-section__title">
              Petition for entry to the hosted edition.
            </h1>

            <p className="cd-dropcap mt-7">
              The hosted edition of <em>forenix/oss</em> opens in small
              batches, each one matched to the analysts, investigators, and
              security teams who have a real case to put through the
              workflow. Tell us a little about yours; that is how we
              prioritise. The source remains MIT-licensed and self-hostable
              from the first commit, with no waiting required.
            </p>
          </div>
        </div>

        <div className="mt-10 max-w-[42em]">
          <WaitlistForm variant="full" source="waitlist-page" />
        </div>

        <hr className="cd-rule mt-16" />

        <div className="cd-smallcaps mt-6 text-[12px]">also of note</div>
        <ul className="cd-fn-list">
          <li>
            <strong>Already an admitted party?</strong>{" "}
            <Link href="/sign-in">Sign in</Link> to your team workspace.
          </li>
          <li>
            <strong>Wish to read first?</strong>{" "}
            The full feature set is live at{" "}
            <a
              href="https://demo.forenix.tech"
              target="_blank"
              rel="noopener noreferrer"
            >
              demo.forenix.tech
            </a>
            .
          </li>
          <li>
            <strong>Self-hosting?</strong>{" "}
            The source is MIT-licensed at{" "}
            <a
              href="https://github.com/thunderstornX/forenix-oss"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/thunderstornX/forenix-oss
            </a>
            . Clone and run; no application needed.
          </li>
        </ul>
      </section>
    </MarketingShell>
  );
}
