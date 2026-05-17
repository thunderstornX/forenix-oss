# Deploying forenix-oss to Vercel

A repeatable, 10-minute deploy. The whole platform runs on
Vercel's free tier paired with Neon's free Postgres tier  -  no
credit card required for the demo path.

## What you need

- A GitHub account with this repo pushed to it.
- A free [Vercel](https://vercel.com) account.
- A free [Neon](https://neon.tech) account for Postgres.
- (Optional) The same OpenRouter / NVIDIA / xAI keys as local
  dev  -  Vercel will inject them as env vars.

## Step 1  -  provision Postgres on Neon

1. Sign in at <https://neon.tech>.
2. Create a project  -  pick a region close to your users
   (`us-east-1 (AWS)` is a reasonable default).
3. Open the project -> **Connection Details**.
4. Copy the **pooled** connection string (it ends in
   `?sslmode=require&pgbouncer=true`). This is the value you'll
   paste into Vercel as `DATABASE_URL`.

That's it. Neon spins down the compute when idle; the demo will
sleep for free between visits.

## Step 2  -  Vercel project

1. Sign in at <https://vercel.com>.
2. **Add New -> Project**. Import `thunderstornX/forenix-oss`.
3. Framework preset: **Next.js** (auto-detected).
4. **Build command:** leave default (`vercel.json` already pins
   `bun run vercel-build`).
5. **Install command:** leave default.
6. **Root directory:** leave default.
7. Click **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled URL from step 1 |
   | `AUTH_SECRET` | a fresh value  -  `openssl rand -base64 32` |
   | `NEXTAUTH_SECRET` | same value |
   | `NEXTAUTH_URL` | `https://YOUR-DEPLOYMENT.vercel.app` (set after first deploy) |
   | `AUTH_TRUST_HOST` | `true` |
   | `AI_ADAPTER` | `mock` (or `openrouter` / `nvidia` if you have keys) |
   | `OPENROUTER_API_KEY` | (optional) `sk-or-...` |
   | `OPENROUTER_MODEL` | (optional) `openai/gpt-oss-120b:free` |
   | `NVIDIA_API_KEY` | (optional) `nvapi-...` |
   | `NVIDIA_MODEL` | (optional) `meta/llama-3.3-70b-instruct` |
   | `GROQ_API_KEY` | **(recommended for Vercel demo)** `gsk_...`  -  free, no card |
   | `GROQ_MODEL` | (optional) `llama-3.3-70b-versatile` |
   | `SEED_TOKEN` | a fresh random string  -  `openssl rand -hex 16` |

8. Click **Deploy**. Watch the build log; it runs `prisma
   db push` against your Neon database before `next build`.

## Step 3  -  seed the demo data

Once the deploy is live, hit the seed endpoint **once**:

```bash
curl -X POST -H "content-type: application/json" \
  -d '{"token":"YOUR_SEED_TOKEN"}' \
  https://YOUR-DEPLOYMENT.vercel.app/api/admin/seed-demo
```

The response:

```json
{
  "data": {
    "users": 3,
    "team": "forenix-demo",
    "case": "CASE-2025-007",
    "message": "Demo data seeded. Sign in with the seeded accounts."
  }
}
```

To wipe and re-seed (when the demo has been mutated), pass
`force: true` along with the same token:

```bash
curl -X POST -H "content-type: application/json" \
  -d '{"token":"YOUR_SEED_TOKEN","force":true}' \
  https://YOUR-DEPLOYMENT.vercel.app/api/admin/seed-demo
```

## Step 4  -  first sign-in

Open `https://YOUR-DEPLOYMENT.vercel.app`. You should be bounced
to `/sign-in`. The seed script creates three role-test accounts
(admin / investigator / analyst). **Operate the deployment as
invite-only:** before sharing the URL, sign in as the admin once
and either rotate the seeded passwords (Admin -> Users) or use
them only for your own evaluation. Do not publish the seeded
credentials in any client-facing material  -  see the in-app sign-in
page (which intentionally shows no credential hints) for the
intended user experience.

## Step 5  -  go live + tell users

- Set `NEXTAUTH_URL` to the actual deployment URL (Vercel sets
  `VERCEL_URL` automatically but next-auth wants `NEXTAUTH_URL`).
- Add a custom domain if you have one (Vercel -> Settings ->
  Domains).
- Share the URL + credentials with invited users only.

## Vercel pricing notes

| Plan | Function timeout | Notes |
|---|---|---|
| **Hobby (free)** | up to 60s | The pipeline route declares `maxDuration = 60`. Works comfortably with `mock` (< 1s) and `groq` (~ 4s). NVIDIA (~ 47s) usually fits. OpenRouter's slower models (~ 80s) will time out. |
| **Pro ($20/mo)** | up to 300s | All adapter calls fit comfortably. Recommended for anything serious. |

For a **completely free** demo, set `AI_ADAPTER=groq` and a
`GROQ_API_KEY`  -  Groq's free tier is generous, the LPU runs a
3-agent-group pipeline in 4 seconds, and the chain stays green
throughout.

If even that's overkill, `AI_ADAPTER=mock` works with zero env
variables and lets reviewers explore the UI without any external
dependency at all.

## Going to production

When you outgrow the Hobby plan:

- Switch Neon to a paid tier for higher connection limits and
  no idle suspend.
- Move from the pooled connection to a dedicated branch per
  environment.
- Set `AI_ADAPTER=openrouter` (or your provider of choice) and
  add the production keys as **Production-scoped** env vars.
- Enable Vercel's audit log on the project so platform-level
  changes are tracked alongside the app's own audit chain.

## What can break

| Symptom | Most likely cause |
|---|---|
| `Error: invalid_url` on first request | `NEXTAUTH_URL` not set or stale. Vercel doesn't auto-fill this. |
| `401 unauthenticated` on every request | `AUTH_SECRET` and `NEXTAUTH_SECRET` don't match. They must both be set to the same value. |
| `Error: PgBouncer transaction mode` from Prisma | Use the *pooled* Neon URL on the `DATABASE_URL`, not the direct connection. |
| Pipeline calls return 504 | Adapter ran past `maxDuration`. Switch to `mock` or upgrade to Vercel Pro. |
| `Function timed out` on `vercel-build` | Neon spun down. First request wakes it up  -  retry. |
| 403 on `/api/admin/seed-demo` | Wrong `SEED_TOKEN`. |
| 409 `already_seeded` | Database already has users. Pass `force: true` to wipe + re-seed. |

## Why we chose this stack

- **Vercel**  -  first-party Next.js host, free tier covers a demo.
- **Neon**  -  Postgres-as-a-service with branching, free tier
  generous enough for a demo, transparent pricing if it grows.
- **Bun**  -  Vercel detects it from `bun.lock` and uses it for
  installs. Build itself runs on Node.
- **No file storage on Vercel**  -  Evidence bytes will live in
  S3-compatible storage (R2 / Backblaze) when Phase 8 ships;
  for now the platform stores only hashes + metadata.
