#!/usr/bin/env bun
/**
 * Conditional seed wrapper used by Vercel's build step.
 *
 * Why: prisma/seed.ts is destructive (it deleteMany's everything
 * before reseeding) so we can't safely call it on every deploy of
 * a populated database. This wrapper checks for existing users; if
 * any exist, it skips seeding entirely. If the database is empty,
 * it runs the seed.
 *
 * Used by the vercel-build script. The DigitalOcean droplet has
 * its own initial-seed flow and does NOT call this — it's wired
 * specifically for the Vercel concept surface, where a destructive
 * seed of seeded-demo-data is the intended bootstrap.
 *
 * Override: FORCE_RESEED=true will run the seed even if data
 * exists, wiping everything first. Use with care.
 */
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

async function main() {
  const force = process.env.FORCE_RESEED === "true";
  const prisma = new PrismaClient();

  try {
    const userCount = await prisma.user.count();

    if (userCount > 0 && !force) {
      console.log(
        `✓ DB has ${userCount} user(s) — skipping seed (set FORCE_RESEED=true to override)`,
      );
      await prisma.$disconnect();
      return 0;
    }

    if (force && userCount > 0) {
      console.log(
        `! FORCE_RESEED set — wiping + reseeding (${userCount} existing user(s))`,
      );
    } else {
      console.log("✓ Empty DB detected — seeding…");
    }
  } catch (err) {
    // Couldn't connect or query — that's usually a transient build
    // env issue. Don't fail the build here; let the seed itself
    // surface a real connection error if any.
    console.warn(
      "⚠ seed-if-empty: count check failed:",
      (err as Error).message,
    );
    console.warn("  proceeding to seed anyway");
  } finally {
    await prisma.$disconnect();
  }

  // Spawn the seed as a separate process via tsx (devDep, in PATH
  // inside Vercel's build sandbox) so its own process.exit at the
  // end doesn't escape into this wrapper.
  const result = spawnSync("tsx", ["prisma/seed.ts"], {
    stdio: "inherit",
    env: { ...process.env, PRISMA_SCHEMA: "prisma/schema.postgres.prisma" },
  });
  return result.status ?? 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
