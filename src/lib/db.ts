/**
 * Singleton Prisma client.
 *
 * Next.js dev-server hot-reloading would otherwise instantiate a new
 * client on every recompile and exhaust connection limits — pinning
 * it on `globalThis` is the documented workaround.
 */
import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
