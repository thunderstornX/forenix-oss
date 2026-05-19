# SaaS premium tier

The same codebase that ships as MIT-licensed OSS Core also drives the
paid hosted product. This document covers what the SaaS tier is, what
is gated, what is planned, and how the boundary is enforced in code.

For the OSS install path see [`OSS_INSTALL.md`](OSS_INSTALL.md). For
the Vercel demo specifics see [`VERCEL_DEPLOY.md`](VERCEL_DEPLOY.md).

---

## 1. The three lanes

| Lane | Live at | Audience | What it is |
|---|---|---|---|
| **OSS Core** (MIT) | this GitHub repo | self-hosters, evaluators, integrators | every analyst feature, every adapter except Claude, audit chain, branch graph, verifier, real Git per case, full subprocess tool registry |
| **Concept + waitlist** | [forenix.tech](https://forenix.tech) | the public | marketing site + serverless concept demo (mock adapter, deterministic Git fallback). This surface is where prospective customers read the pitch and **join the waitlist** for the paid SaaS. |
| **Paid SaaS** | [demo.forenix.tech](https://demo.forenix.tech) | **invite / register only** (waitlist approval required) | the actual product, running the OSS Core build under systemd + Caddy on a DigitalOcean droplet, with the deep OSINT toolchain installed, real LLM via OpenRouter, and the SAAS-gated features below (as they ship). |

The customer journey is **forenix.tech → waitlist → admin approves →
demo.forenix.tech**. The three lanes are not separate codebases. They
are the same Next.js app toggled by environment variables.

---

## 2. The single gate

A single environment variable controls the SaaS tier:

```bash
SAAS_MODE=true
```

When it is `true`, premium features become available. When it is
`false` (the default), premium features are silently absent and every
OSS feature behaves identically. The BRD enforces this in §7: premium
features are **additive, never restrictive**. The OSS path is never
allowed to depend on a premium one.

The only other knob in flight is `AI_ADAPTER`, which selects which
LLM adapter the pipeline talks to. Setting `AI_ADAPTER=claude`
without `SAAS_MODE=true` causes the Claude adapter to warn at
construction and throw on every call.

---

## 3. The code boundary

Premium code lives under [`src/lib/saas/`](../src/lib/saas/). The
rule, documented in [`src/lib/saas/README.md`](../src/lib/saas/README.md),
is:

> OSS code paths must not import from `src/lib/saas/`. The single
> exception is `src/lib/ai/adapter.ts`, which is the gate.

If you find an OSS feature transitively pulling in something from
`src/lib/saas/`, that is the bug. The boundary is intentional and
checked at review time, not enforced by a lint rule (yet).

---

## 4. What is gated today

As of `v0.4.0` the **paid SaaS is live at
[demo.forenix.tech](https://demo.forenix.tech)** as a single-tenant
deployment. The waitlist on
[forenix.tech](https://forenix.tech) is the entry point; an admin
provisions accounts on the droplet after approval.

What's gated by `SAAS_MODE=true` *in code* today:

| Feature | Gate | Status |
|---|---|---|
| `ClaudeAdapter` | `SAAS_MODE=true` + `ANTHROPIC_API_KEY` | Stub - constructor wired, calls throw `NotImplementedError`. Awaiting an Anthropic SDK implementation. |
| `saasMode` flag exposed on `/api/health` and `/api/settings` | always | Informational only; the UI shows the current state. |

So the SaaS surface exists and serves customers today on the same
code as the OSS Core. The paid-tier *features* below (multi-tenant,
billing, SSO, etc.) are what's not yet shipped into that deployment.

---

## 5. What is planned

Per BRD §4 (FR-18 onwards) and §7:

| Feature | BRD ID | Status |
|---|---|---|
| Multi-tenant org isolation + RBAC | FR-21 | not started - the SaaS keystone |
| PDF report export | FR-20 | not started |
| Advanced OSINT adapters (Shodan, Censys, Hunter, HIBP at metered cadence) | n/a | not started |
| SSO (SAML / OIDC) | n/a | not started |
| Usage metering | n/a | not started |
| Billing (Stripe customer + subscription + invoice webhooks) | n/a | not started |
| Production runbook for multi-tenant deploys | n/a | not started |
| Support tooling | n/a | not started |

Anything in this list will land under `src/lib/saas/` and will be
gated behind `SAAS_MODE=true`.

---

## 6. Running with SaaS mode enabled (dev / preview)

```bash
# 1. Get an Anthropic key
export ANTHROPIC_API_KEY=sk-ant-...

# 2. Flip the gate
export SAAS_MODE=true

# 3. Tell the pipeline to use Claude
export AI_ADAPTER=claude

# 4. Run the app
bun run dev
```

Visit `http://localhost:3000/app?view=settings`. The adapter table
shows Claude as `ACTIVE` rather than `saas-gated`.

If `SAAS_MODE=false`, the same setup shows Claude as `saas-gated` and
the pipeline refuses to invoke it (falls back to mock with a warning
in the logs).

---

## 7. Production deployment (where it runs today)

The paid SaaS runs **today** at
[demo.forenix.tech](https://demo.forenix.tech), single-tenant, on a
DigitalOcean droplet using the systemd unit + Caddy front documented
in [`SELF_HOST.md`](SELF_HOST.md). Customer onboarding is operator-
driven: approve a waitlist entry on forenix.tech, provision the
account on the droplet, send credentials.

The Phase 9.4+ pieces that turn this into a true multi-tenant SaaS:

- **Multi-tenant Postgres** - either row-level tenancy on the existing
  schema or schema-per-org. Choice has not been made.
- **Per-org Git roots** - cases live under
  `/var/forenix/cases/<org_id>/<case_id>` not the shared
  `/var/forenix/cases/<case_id>`.
- **Stripe webhooks** at `/api/billing/webhook` - to be added under
  `src/app/api/billing/` and gated by `SAAS_MODE`.
- **Caddy or Cloudflare** front for `*.forenix-oss.com` or the chosen
  SaaS domain, with org-subdomain routing.
- **Job queue** for billing reconciliation + usage rollups - not
  decided whether to reuse the cron infra or add BullMQ.

This document gets updated as each piece lands.

---

## 8. The OSS / SaaS social contract

The reason for a single codebase with an env gate, rather than two
repos, is simple: every commit that makes the OSS lane better must
also make the SaaS lane better, and every SaaS-only feature must be
clean enough that an OSS user reading the code does not feel cheated.
The OSS lane is the product. The SaaS lane is the OSS lane with the
operational burden removed and the premium-only adapters wired up.

If a feature would make sense in OSS, it ships in OSS. If a feature
genuinely depends on hosting capital (third-party API quota,
multi-tenant infra, a support team), it ships behind `SAAS_MODE`.
