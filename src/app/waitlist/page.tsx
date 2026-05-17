import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const metadata = {
  title: "Join the waitlist — forenix-oss",
  description:
    "Get early access to forenix-oss. We send invites in small batches to analysts, investigators, and security teams who want to try the full workflow against a real case.",
};

export default function WaitlistPage() {
  return (
    <MarketingShell>
      <section className="relative mx-auto max-w-2xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back home
        </Link>
        <h1 className="mt-6 text-balance text-[32px] font-semibold tracking-tight text-[var(--foreground)] sm:text-[40px]">
          Join the <span className="text-[var(--accent-strong)]">forenix-oss</span> waitlist.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--foreground-muted)]">
          We&apos;re onboarding analysts, investigators, and security teams in small
          batches. Tell us a little about yourself and your use case — it helps us
          prioritise the right early invites.
        </p>
        <div className="mt-8">
          <WaitlistForm variant="full" source="waitlist-page" />
        </div>

        <ul className="mt-10 space-y-3 text-[13px] text-[var(--foreground-muted)]">
          <Bullet>
            <strong className="text-[var(--foreground)]">Already have access?</strong>{" "}
            <Link href="/sign-in" className="text-[var(--accent-strong)] hover:underline">
              Sign in
            </Link>{" "}
            to your team workspace.
          </Bullet>
          <Bullet>
            <strong className="text-[var(--foreground)]">Want to look around first?</strong>{" "}
            The full feature set is live at{" "}
            <a
              href="https://demo.forenix.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-strong)] hover:underline"
            >
              demo.forenix.tech
            </a>
            .
          </Bullet>
          <Bullet>
            <strong className="text-[var(--foreground)]">Self-hosting?</strong>{" "}
            The source is MIT-licensed at{" "}
            <a
              href="https://github.com/thunderstornX/forenix-oss"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-strong)] hover:underline"
            >
              github.com/thunderstornX/forenix-oss
            </a>
            .
          </Bullet>
        </ul>
      </section>
    </MarketingShell>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent-strong)]" />
      <span>{children}</span>
    </li>
  );
}
