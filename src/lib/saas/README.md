# `src/lib/saas/`  -  the premium boundary

Anything inside this directory implements a **SaaS-premium-tier**
feature. Nothing here runs in the OSS lane.

## The rule

> **OSS code paths MUST NOT import from `src/lib/saas/`.**
>
> The single exception is the AI adapter factory at
> `src/lib/ai/adapter.ts`, which imports premium adapters as classes
> so the registry stays single-source. Those adapters refuse to
> construct unless `SAAS_MODE=true`, so a static import is inert in
> the OSS lane.

If you find a non-factory OSS file importing from `src/lib/saas/`,
that is the bug.

## The contract

- **Every file under `src/lib/saas/` checks `SAAS_MODE` before doing
  any premium work.** Construction is allowed to throw / warn when
  the flag is missing.
- **Premium features are additive, never restrictive.** If
  `SAAS_MODE=false`, every OSS feature behaves identically. Premium
  features either appear or do not  -  they never alter the OSS path.
- **The flag is a single env var.** Do not invent a parallel flag
  ("PRO_TIER", "ENTERPRISE", etc.); SaaS gating is one switch.

## What lives here today

| Module | Purpose |
|---|---|
| `adapters/claude.ts` | Anthropic Claude adapter. Requires `ANTHROPIC_API_KEY` + `SAAS_MODE=true`. |

## What is planned to live here (BRD §7)

- Multi-tenant org isolation + RBAC (FR-21)
- PDF report export (FR-20)
- Advanced OSINT source adapters (Shodan / Censys / Hunter / HIBP at
  metered cadence)
- SSO (SAML / OIDC)
- Usage metering + billing webhooks
- Stripe customer / subscription / invoice handling

## Why a boundary at all

The whole product runs from one codebase. That is intentional - it
keeps the build simple and avoids a marketplace where the OSS lane
slowly diverges from "the real product." But without an explicit
boundary it is easy to introduce a premium dependency into an OSS
feature without noticing. This directory is the marker. Anything
inside it is paid; anything that imports from it is paid; the OSS
lane stops at the door.
