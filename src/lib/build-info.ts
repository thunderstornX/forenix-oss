/**
 * Deploy provenance — answers "what is actually running right now?"
 *
 * The Deploy workflow stamps a `.revision` JSON file ({commit, builtAt})
 * into the deploy root at rsync time. We read it once, lazily, and
 * cache. On Vercel or in local dev there is no `.revision`, so it
 * reports nulls rather than guessing — better an honest blank than a
 * stale SHA (which is exactly the trap the on-droplet `.git` used to be).
 *
 * An explicit FORENIX_BUILD_SHA / FORENIX_BUILT_AT env pair takes
 * precedence, for hosts that prefer to inject it that way.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface BuildInfo {
  commit: string | null;
  builtAt: string | null;
}

let cached: BuildInfo | null = null;

export function buildInfo(): BuildInfo {
  if (cached) return cached;
  cached = readRevision();
  return cached;
}

function readRevision(): BuildInfo {
  const envSha = process.env.FORENIX_BUILD_SHA;
  if (envSha) {
    return { commit: envSha, builtAt: process.env.FORENIX_BUILT_AT ?? null };
  }

  try {
    const raw = readFileSync(join(process.cwd(), ".revision"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      return {
        commit: typeof obj.commit === "string" ? obj.commit : null,
        builtAt: typeof obj.builtAt === "string" ? obj.builtAt : null,
      };
    }
  } catch {
    // No .revision (dev, Vercel) — report blank, never a stale guess.
  }
  return { commit: null, builtAt: null };
}
