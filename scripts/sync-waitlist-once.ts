#!/usr/bin/env bun
/**
 * One-time backfill of existing waitlist rows into another
 * deployment via /api/admin/waitlist-import.
 *
 * Use this once, after wiring up cross-deployment sync, to push
 * every row this database has accumulated upstream. From then on,
 * the in-flight sync in src/app/api/waitlist/route.ts handles new
 * signups automatically.
 *
 * Usage:
 *
 *   WAITLIST_SYNC_URL=https://demo.forenix.tech/api/admin/waitlist-import \
 *   WAITLIST_SYNC_TOKEN=<shared-secret> \
 *   WAITLIST_SYNC_ORIGIN=vercel-forenix-tech-backfill \
 *   bun scripts/sync-waitlist-once.ts
 *
 * Reads from whatever DATABASE_URL Prisma sees, so run from the
 * source deployment's env (e.g. Vercel: `vercel env pull .env`).
 *
 * Idempotent: the receiver upserts by email, so re-running is safe.
 */
import { prisma } from "../src/lib/db";

const URL_ = process.env.WAITLIST_SYNC_URL;
const TOKEN = process.env.WAITLIST_SYNC_TOKEN;
const ORIGIN = process.env.WAITLIST_SYNC_ORIGIN ?? "backfill";

if (!URL_ || !TOKEN) {
  console.error("Set WAITLIST_SYNC_URL and WAITLIST_SYNC_TOKEN before running.");
  process.exit(1);
}

async function main() {
  const rows = await prisma.waitlistSignup.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      email: true,
      role: true,
      useCase: true,
      source: true,
      createdAt: true,
    },
  });

  console.log(`Found ${rows.length} waitlist rows to forward to ${URL_}`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of rows) {
    try {
      const res = await fetch(URL_!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          email: r.email,
          role: r.role ?? undefined,
          useCase: r.useCase ?? undefined,
          source: r.source ?? undefined,
          originalCreatedAt: r.createdAt.toISOString(),
          origin: ORIGIN,
        }),
      });
      const json = (await res.json()) as {
        data?: { ok: true; status: "imported" | "exists"; position: number };
        error?: string;
      };
      if (res.ok && json.data?.ok) {
        if (json.data.status === "imported") ok += 1;
        else skipped += 1;
        process.stdout.write(json.data.status === "imported" ? "+" : ".");
      } else {
        failed += 1;
        process.stdout.write("!");
        console.error(`\n  ${r.email}: ${res.status} ${json.error ?? "unknown"}`);
      }
    } catch (err) {
      failed += 1;
      process.stdout.write("!");
      console.error(`\n  ${r.email}: ${(err as Error).message}`);
    }
  }

  console.log(`\n\n✓ imported: ${ok}  already existed: ${skipped}  failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
