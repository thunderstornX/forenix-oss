/**
 * API-key vault  -  admin-only writes, runtime reads.
 *
 * Storage: the `ApiKey` Prisma model. AES-256-GCM at rest.
 *
 * Runtime behaviour: when a tool with `apiKeyEnv` is invoked, the
 * runner calls `injectVaultKeys()` first to set the relevant
 * process.env entry from the decrypted vault row. If a key is also
 * present directly in the environment, the env value wins (self-host
 * convention).
 */
import "server-only";

import { prisma } from "./db";
import { decrypt, encrypt, preview } from "./secrets";

let cache: { loadedAt: number; keys: Map<string, string> } = {
  loadedAt: 0,
  keys: new Map(),
};
const CACHE_TTL_MS = 30_000;

/** Re-hydrate the in-memory cache from the database. */
async function refresh(): Promise<void> {
  const rows = await prisma.apiKey.findMany({
    select: { envKey: true, ciphertext: true, iv: true, tag: true },
  });
  const fresh = new Map<string, string>();
  for (const row of rows) {
    try {
      const value = decrypt({
        ciphertext: row.ciphertext,
        iv: row.iv,
        tag: row.tag,
      });
      fresh.set(row.envKey, value);
    } catch {
      // skip rows we can't decrypt (e.g. AUTH_SECRET rotated)
    }
  }
  cache = { loadedAt: Date.now(), keys: fresh };
}

/** Make every vault key available via process.env for the lifetime
 *  of the current request. Cheap to call repeatedly  -  uses a 30 s
 *  in-memory cache to avoid hitting the database every tool call. */
export async function injectVaultKeys(): Promise<void> {
  if (Date.now() - cache.loadedAt > CACHE_TTL_MS) {
    await refresh();
  }
  for (const [envKey, value] of cache.keys.entries()) {
    if (!process.env[envKey]) {
      process.env[envKey] = value;
    }
  }
}

/** Force-rebuild the cache (call after admin writes). */
export async function reloadVault(): Promise<void> {
  cache = { loadedAt: 0, keys: new Map() };
  await refresh();
}

export interface VaultRow {
  id: string;
  envKey: string;
  label: string;
  redactedValue: string;
  setAt: Date;
  rotatedAt: Date | null;
  lastUsedAt: Date | null;
}

/** Admin-only  -  list every stored key (redacted). */
export async function listVault(): Promise<VaultRow[]> {
  const rows = await prisma.apiKey.findMany({ orderBy: { setAt: "desc" } });
  return rows.map((r) => {
    let redacted = "(decrypt failed)";
    try {
      const v = decrypt({ ciphertext: r.ciphertext, iv: r.iv, tag: r.tag });
      redacted = preview(v);
    } catch { /* leave as decrypt-failed */ }
    return {
      id: r.id,
      envKey: r.envKey,
      label: r.label,
      redactedValue: redacted,
      setAt: r.setAt,
      rotatedAt: r.rotatedAt,
      lastUsedAt: r.lastUsedAt,
    };
  });
}

/** Admin-only  -  upsert a key. */
export async function setVaultKey(args: {
  envKey: string;
  label: string;
  plaintext: string;
  setById: string;
}): Promise<void> {
  const { envKey, label, plaintext, setById } = args;
  const enc = encrypt(plaintext);
  const existing = await prisma.apiKey.findUnique({ where: { envKey } });
  if (existing) {
    await prisma.apiKey.update({
      where: { id: existing.id },
      data: {
        label,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        tag: enc.tag,
        setById,
        rotatedAt: new Date(),
      },
    });
  } else {
    await prisma.apiKey.create({
      data: {
        envKey,
        label,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        tag: enc.tag,
        setById,
      },
    });
  }
  await reloadVault();
}

/** Admin-only  -  delete a key by envKey. */
export async function removeVaultKey(envKey: string): Promise<void> {
  await prisma.apiKey.deleteMany({ where: { envKey } });
  await reloadVault();
}
