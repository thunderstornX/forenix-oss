"use client";

/**
 * SaaS organisations view — OSS stub.
 *
 * This file exists in the public OSS repo so the dashboard's
 * ViewRouter can resolve the import at TypeScript build time. The
 * real implementation ships in the private SaaS overlay
 * (forenix-saas) and replaces this stub during the DO deploy
 * pipeline's assembly step.
 *
 * What an OSS self-hoster sees: a "this view is part of the SaaS
 * overlay" placeholder explaining that organisations are managed
 * by a separate, optional, paid module. They still have the orgs
 * schema (User.orgId, Team.orgId, Organization model) — they just
 * don't have an in-app UI for managing it. They can use:
 *   - scripts/saas-create-org.ts (CLI bootstrap), or
 *   - any Prisma-aware tool.
 *
 * What the SaaS surface (demo.forenix.tech) shows: the real org
 * admin UI from the overlay.
 */
import { Building2, ExternalLink, ShieldCheck } from "lucide-react";

import { ViewShell } from "./view-shell";

export function SaasOrganisationsView() {
  return (
    <ViewShell
      title="Organisations"
      subtitle="Multi-tenant org administration is part of the SaaS overlay, not OSS Core. This view explains how to enable it."
    >
      <div className="fx-card">
        <div className="fx-card__body space-y-4">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
            <div className="text-[14px] leading-[1.55]">
              <p className="font-medium text-[var(--fg-strong)]">
                You&apos;re looking at OSS Core.
              </p>
              <p className="mt-2 text-[var(--fg-muted)]">
                Multi-tenant organisations are a SaaS-overlay feature. The
                org schema is already in this repo&apos;s Prisma file (so
                self-hosters can use orgs at the database level), but the
                in-app admin UI ships only on the hosted product at{" "}
                <a
                  href="https://demo.forenix.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  demo.forenix.tech
                </a>
                . The overlay (private repo{" "}
                <code className="fx-chip fx-chip--mono">forenix-saas</code>)
                provides the CRUD endpoints + this view&apos;s real
                implementation.
              </p>
            </div>
          </div>

          <hr className="cd-rule" />

          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--success)]" />
            <div className="text-[14px] leading-[1.55] text-[var(--fg-muted)]">
              <p className="font-medium text-[var(--fg-strong)]">
                Want to use orgs anyway in OSS?
              </p>
              <p className="mt-2">
                The schema works. Bootstrap an org and attach your users
                with the CLI helper that ships in the overlay (also free
                for OSS):
              </p>
              <pre className="fx-code mt-2 text-[11px]">
                bun scripts/saas-create-org.ts &quot;Your Org&quot; your-org --attach-all-users
              </pre>
              <p className="mt-2">
                Once <code className="fx-chip fx-chip--mono">SAAS_MODE=true</code>{" "}
                and a user has{" "}
                <code className="fx-chip fx-chip--mono">orgId</code> set, the
                existing scope helper (
                <code className="fx-chip fx-chip--mono">teamScopeWhere</code>)
                automatically restricts every list query to that org.
              </p>
            </div>
          </div>

          <hr className="cd-rule" />

          <div className="flex items-start gap-3">
            <ExternalLink className="mt-0.5 h-5 w-5 text-[var(--fg-muted)]" />
            <div className="text-[14px] leading-[1.55] text-[var(--fg-muted)]">
              <p className="font-medium text-[var(--fg-strong)]">
                Want the hosted product?
              </p>
              <p className="mt-2">
                Join the waitlist at{" "}
                <a
                  href="https://forenix.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  forenix.tech
                </a>
                . Once approved you get access to{" "}
                <a
                  href="https://demo.forenix.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  demo.forenix.tech
                </a>{" "}
                where this view is fully functional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
