# Development flow

Three live surfaces, one source-of-truth codebase, an overlay for
premium-only code, and two auto-deploy pipelines.

```
                      ┌──────────────────────────┐
                      │  forenix-oss (this repo) │   public, MIT
                      └──────────┬───────────────┘
                                 │  push to main
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌─────────┐         ┌─────────┐         ┌─────────────┐
        │ Vercel  │         │ GH      │         │ forenix-saas│   private overlay
        │ deploy  │         │ Actions │◄────────│ (this repo's│   pulled at build time
        │         │         │  +SSH   │         │  overlay/)  │
        └────┬────┘         └────┬────┘         └─────────────┘
             ▼                   ▼
       forenix.tech       demo.forenix.tech
       (concept, mocks)   (live demo, DigitalOcean)
```

---

## 1. Where each kind of work lands

| Work | Lives in | Goes live on |
|---|---|---|
| Any analyst feature (audit chain, monitors, attestation, OSINT tools, dashboards) | **forenix-oss** | Vercel concept + DO paid + every self-hoster |
| Marketing copy, landing redesign, waitlist form | **forenix-oss** | Vercel concept + DO (DO doesn't show `/` since visitors go straight to `/sign-in`) |
| "Try the demo" visitor path | **forenix-oss**, gated by `DEMO_VISITOR_ENABLED=true` (set on Vercel only) | Vercel concept only |
| Premium / SaaS features (Claude adapter, multi-tenant orgs, billing, SSO, PDF export, advanced OSINT adapters) | **forenix-saas** (overlay) | DO paid only |
| Operational scripts (deploy, sync, backfill) | **forenix-oss** under `scripts/` | wherever invoked (CI, droplet, operator laptop) |

**Default**: assume OSS unless the feature genuinely needs paid-tier
infrastructure (third-party API quota, multi-tenant isolation, billing,
support obligations). Per BRD §7, premium is *additive, never restrictive* —
OSS lane must keep working when the overlay is absent.

---

## 2. Push-to-deploy pipeline

A single `git push origin main` triggers:

1. **Vercel auto-deploy** (Git integration): build runs
   `prisma generate → prisma db push → tsx scripts/seed-if-empty.ts → next build`.
   Aliased to `forenix.tech` + `www.forenix.tech` on success. ~1 min.

2. **GitHub Actions `deploy-droplet.yml`** (push trigger): checks out OSS Core + `forenix-saas`
   overlay (via `SAAS_REPO_TOKEN`), rsyncs the merged tree onto the
   droplet, runs `scripts/deploy-droplet.sh` over SSH which does
   `bun install → prisma generate → prisma db push → bun run build →
   systemctl restart`, then hits `/api/health` as a smoke check. ~2-3 min.

When pushing to `forenix-saas` (the private overlay) WITHOUT a
corresponding OSS change, you must trigger a redeploy manually:

```bash
gh workflow run deploy-droplet.yml --repo thunderstornX/forenix-oss --ref main
# or land an empty commit on OSS main
git commit --allow-empty -m "chore: redeploy for overlay change"
git push origin main
```

---

## 3. Catch-up across surfaces

The three surfaces stay in sync automatically as long as both auto-deploy
pipelines are green. When they drift:

- **Vercel ahead of DO**: GH Actions failed. Check
  `gh run list --repo thunderstornX/forenix-oss --workflow deploy-droplet.yml --limit 1`.
  The smoke check on `/api/health` is the first signal.
- **DO ahead of Vercel**: Vercel build failed (rare; usually a Prisma
  schema mismatch or a missing env). Check Vercel dashboard.
- **DO ahead of OSS public**: a hot-fix was made by SSH-editing the
  droplet directly. **Don't.** Make the fix in `forenix-oss`, push,
  let the pipeline catch the droplet up.
- **Overlay change not on DO**: the public push didn't include an
  overlay update, so the build cache reused the previous overlay sha.
  Trigger a manual redeploy as above.

`docs/09-RUNBOOK.md` §13 covers the deploy + §14 covers the waitlist
sync. Keep them current when the pipelines change.

---

## 4. Testing layers

| Layer | What it catches | How to run |
|---|---|---|
| **TypeScript** (`bun run typecheck`) | type errors before runtime | every commit, locally |
| **ESLint** (`bun run lint`) | unused/dangerous patterns, prefer-const, etc. | every commit, locally |
| **Unit** (`bun test`) | pure-logic regressions (audit chain, cadence parser, event emitter, evidence store, etc.) | every commit; CI runs on push |
| **Production build** (`bun run build`) | wiring errors, missing imports, schema mismatches | every commit |
| **Smoke check** (`GET /api/health → 200`) | service responding after deploy | automatic, end of GH Actions workflow |
| **End-to-end** (Playwright scripts in `/tmp/*.ts` during dev) | visual regressions, demo flow, sign-in path | ad-hoc, before shipping a UI change |
| **Manual** (humans on the live site) | what only humans notice (copy, motion, microcopy) | after every meaningful UI ship |

Rule of thumb: **never push code that breaks `bun run typecheck`, `bun run lint`, `bun test`, or `bun run build` locally.** All four must be green before `git push`.

---

## 5. Release cadence

We're on `v0.x.x`. Tags happen when a coherent set of work lands. Each
release earns a Zenodo DOI via the GitHub-integration archival path,
recorded in `CITATION.cff`. Recent tags:

- `v0.4.0` external attestation (cron-driven) + monitors v1
- `v0.5.0` visitor demo path + waitlist admin UI + overlay extraction
- `v0.5.1` multi-tenant orgs + research framing
- `v0.5.2` research artefact corrections + reproducibility infrastructure
- `v0.5.3` operational truthfulness pass
- `v0.5.4` Rekor ECDSA + BigInt safe-json + case-repo backfill

When tagging:

```bash
git tag -a v0.5.x -m "v0.5.x: <one-line summary>"
git push origin v0.5.x
```

Overlay tags follow the public tag with a `+saasN` suffix
(see `forenix-saas/CHANGELOG.md`).

---

## 6. The one big thing not to forget

**OSS users running `git clone forenix-oss` get a fully working
self-host.** They get every analyst feature, every free adapter, the
full audit chain, scheduled monitors, scheduled attestations, SSE live
updates, the visitor demo path (if they enable it). Nothing critical
ever goes overlay-only that an OSS self-hoster would consider table-
stakes. The overlay is where commercial-grade pieces live (billing,
multi-tenancy, SSO, premium adapters with paid API quota).

If a feature lands in the overlay that should have been in OSS, that's
the bug. Move it down.
