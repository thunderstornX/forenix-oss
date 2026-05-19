# The paid SaaS — and why no premium code lives in this repo

This document is the short answer to "where are the premium features
I read about?"

**They are not in this repository.** Premium / SaaS-only code lives
in a private overlay that powers the hosted product at
[demo.forenix.tech](https://demo.forenix.tech). The public
`forenix-oss` repo on GitHub is the **OSS Core**: every analyst
feature, every free adapter, the full audit chain, real Git per
case, the full subprocess OSINT toolchain. Self-hosters get the
sovereign-deployment build, no paid features required.

For the install path see [`OSS_INSTALL.md`](OSS_INSTALL.md). For the
Vercel concept surface see [`VERCEL_DEPLOY.md`](VERCEL_DEPLOY.md).

---

## 1. The three lanes

| Lane | Live at | Audience | What it is |
|---|---|---|---|
| **OSS Core** (MIT) | this GitHub repo | self-hosters, evaluators, integrators | every analyst feature, every free adapter, audit chain, branch graph, verifier, real Git per case, full subprocess tool registry, scheduled monitors + attestations, SSE live updates |
| **Concept + waitlist** | [forenix.tech](https://forenix.tech) | the public | marketing site + serverless concept demo (mock adapter, deterministic Git fallback). Where prospective customers read the pitch and **join the waitlist** |
| **Paid SaaS** | [demo.forenix.tech](https://demo.forenix.tech) | **invite / register only** (waitlist approval) | OSS Core **+ a private SaaS overlay** that adds Claude adapter, multi-tenant orgs, billing, SSO, PDF export, advanced OSINT adapters |

The customer journey is **forenix.tech → waitlist → admin approves →
demo.forenix.tech**.

---

## 2. The overlay model

The DigitalOcean droplet that runs the paid SaaS is built by
assembling two repositories at deploy time:

```
public:   github.com/thunderstornX/forenix-oss   (this repo, MIT)
private:  github.com/thunderstornX/forenix-saas  (overlay, all rights reserved)
```

The deploy workflow checks out both and copies the overlay's
`src/lib/saas/` tree into the OSS build before running `bun run
build`. The OSS Core has no knowledge of the overlay; the overlay
depends on the OSS Core's typed boundaries. Premium features are
**additive, never restrictive** — every OSS feature behaves
identically whether or not the overlay is present.

---

## 3. What the `SAAS_MODE` env var does

In OSS Core it is **informational only**. `SAAS_MODE=true` in this
repository activates nothing, because there is no premium code to
activate. The value is exposed on `/api/health` and `/api/settings`
so you can confirm at a glance which build you are looking at.

In the paid SaaS build (overlay present), `SAAS_MODE=true` is what
the overlay reads to gate Claude adapter, multi-tenant org
isolation, billing webhooks, and SSO.

If you flip `SAAS_MODE=true` in an OSS-only install, nothing
changes. If a self-hoster wanted to build the equivalent of the
paid SaaS, they would either pay for the hosted product or
implement the overlay themselves — the public docs do not provide a
how-to.

---

## 4. What the overlay provides today

| Feature | Status in the SaaS overlay |
|---|---|
| `ClaudeAdapter` (Anthropic) | wired |
| `saasMode` flag exposure | wired |
| Multi-tenant org isolation + RBAC | Phase 9.4 (in progress) |
| PDF report export | planned |
| Advanced OSINT adapters (Shodan, Censys, Hunter, HIBP, metered) | planned |
| SSO (SAML / OIDC) | planned |
| Usage metering + Stripe billing | planned |
| Support portal | planned |

Anything not on this list is OSS Core. The overlay never gates an
existing OSS feature; if it did, that would be a regression.

---

## 5. If you want the paid product

Join the waitlist at [forenix.tech](https://forenix.tech). The
journey is: read → waitlist → admin approves → use
[demo.forenix.tech](https://demo.forenix.tech).

If you want to self-host the OSS Core instead, see
[`OSS_INSTALL.md`](OSS_INSTALL.md). The OSS lane is the product;
the paid SaaS is the OSS lane with the operational burden removed
and the overlay attached.
