/**
 * Real file-byte evidence storage.
 *
 * Bytes are written to a content-addressed path on disk:
 *
 *   {FORENIX_EVIDENCE_DIR or /opt/forenix/.evidence-store}/
 *     {caseId}/
 *       {sha256[:2]}/
 *         {sha256}
 *
 * The 2-char shard keeps any one directory below typical fs limits.
 * The filename IS the cryptographic identity of the file - identical
 * bytes inside a case dedupe automatically.
 *
 * Streaming SHA-256: we never hold the whole payload in memory; the
 * hash is computed as the bytes flow through a Transform stream into
 * the destination file. Cap is enforced at the same time.
 *
 * Vercel and other read-only/serverless surfaces should gate writes
 * with `evidenceStorageEnabled()` and return 503.
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  type WriteStream,
} from "node:fs";
import {
  access,
  mkdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

// NB: deliberately no `import "server-only"` here - the node:fs +
// node:crypto imports already prevent client bundling, and the
// server-only sentinel breaks bun:test (it sees the runner as a
// client context).

const DEFAULT_DIR = "/opt/forenix/.evidence-store";
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024; // 500 MB hard cap per upload

// Read env vars through an indirection so Turbopack's static module
// graph can't infer the value at build time. Without this, the
// build trace concluded that storeRoot() could resolve anywhere on
// disk and pulled the whole project into the App Route NFT list
// (visible as "Encountered unexpected file in NFT list" on next
// build). The runtime behaviour is identical; only the build-time
// trace shrinks.
const env = process.env as Record<string, string | undefined>;

export interface StoredEvidence {
  objectKey: string;   // relative key, e.g. "<caseId>/<sha[:2]>/<sha>"
  sha256: string;
  byteCount: number;
}

export interface StoreOptions {
  caseId: string;
  source: AsyncIterable<Uint8Array> | NodeJS.ReadableStream;
  maxBytes?: number;
}

/** Is the on-disk evidence store usable here? */
export function evidenceStorageEnabled(): boolean {
  if (env.FORENIX_DISABLE_EVIDENCE_STORE === "1") return false;
  // Vercel + similar serverless runtimes have read-only filesystems
  // outside /tmp (which is ephemeral and tiny). Refuse uploads there.
  if (env.VERCEL) return false;
  if (env.VERCEL_URL) return false;
  return true;
}

// Known-benign Turbopack warning on build:
//   "Encountered unexpected file in NFT list ... whole project was
//    traced unintentionally"
// followed by an import trace ending in this file. The trace fires
// because Turbopack can't statically scope the fs operations below
// (resolve/join/createReadStream/rename/...) given the runtime env
// var and the dynamic case-scoped subpath. Inline `turbopackIgnore`
// hints + the `env` indirection do not silence it. Build completes,
// route works in production — the warning is informational, not an
// error. Documented so future contributors don't burn time on it.
function storeRoot(): string {
  return resolve(env.FORENIX_EVIDENCE_DIR ?? DEFAULT_DIR);
}

/** Resolve the absolute file path for a content-addressed objectKey. */
export function buildEvidencePath(objectKey: string): string {
  // objectKey is "<caseId>/<sha[:2]>/<sha>"; reject any traversal.
  if (objectKey.includes("..") || objectKey.startsWith("/")) {
    throw new Error("invalid objectKey");
  }
  return join(storeRoot(), objectKey);
}

/**
 * Stream bytes into the store, computing SHA-256 + size on the fly.
 * Atomic: first writes to a temp file, then renames to the final
 * content-addressed path. If a file with this hash already exists
 * (dedup), the temp file is discarded.
 */
export async function storeBytes({
  caseId,
  source,
  maxBytes = DEFAULT_MAX_BYTES,
}: StoreOptions): Promise<StoredEvidence> {
  if (!evidenceStorageEnabled()) {
    throw new Error("evidence storage disabled on this host");
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(caseId)) {
    throw new Error("invalid caseId");
  }

  // Stage in a per-process tmp dir; the rename later is atomic on the
  // same filesystem.
  const stageDir = await mkdir(join(tmpdir(), `forenix-evidence-${process.pid}`), {
    recursive: true,
  }).then(() => join(tmpdir(), `forenix-evidence-${process.pid}`));
  const stagePath = join(stageDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);

  const hash = createHash("sha256");
  let byteCount = 0;
  let exceeded = false;

  const counter = new Transform({
    transform(chunk, _enc, cb) {
      if (exceeded) return cb();
      byteCount += chunk.length;
      if (byteCount > maxBytes) {
        exceeded = true;
        return cb(new Error(`upload exceeds maxBytes=${maxBytes}`));
      }
      hash.update(chunk);
      cb(null, chunk);
    },
  });

  let writeStream: WriteStream | null = null;
  try {
    writeStream = createWriteStream(stagePath, { flags: "wx" });
    await pipeline(source as NodeJS.ReadableStream, counter, writeStream);

    if (byteCount === 0) throw new Error("empty upload");
    const sha256 = hash.digest("hex");
    const objectKey = `${caseId}/${sha256.slice(0, 2)}/${sha256}`;
    const finalPath = buildEvidencePath(objectKey);

    // Ensure shard dir.
    await mkdir(join(storeRoot(), caseId, sha256.slice(0, 2)), { recursive: true });

    // Dedup: if the destination already exists, drop the stage file
    // and return the existing key.
    try {
      await access(finalPath);
      // exists - dedup hit
      await rm(stagePath, { force: true });
      const st = await stat(finalPath);
      return { objectKey, sha256, byteCount: st.size };
    } catch {
      // not present - rename into place
      await rename(stagePath, finalPath);
      return { objectKey, sha256, byteCount };
    }
  } catch (err) {
    // Cleanup partial write on failure.
    try {
      writeStream?.destroy();
    } catch { /* swallow */ }
    await rm(stagePath, { force: true });
    throw err;
  }
}

/** Open a read stream over a stored evidence file. */
export function readEvidence(objectKey: string): NodeJS.ReadableStream {
  return createReadStream(buildEvidencePath(objectKey));
}

/** Re-hash a stored evidence file from disk, return SHA-256 hex. */
export async function rehashEvidence(objectKey: string): Promise<{
  sha256: string;
  byteCount: number;
}> {
  const hash = createHash("sha256");
  let byteCount = 0;
  const stream = createReadStream(buildEvidencePath(objectKey));
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    byteCount += buf.length;
    hash.update(buf);
  }
  return { sha256: hash.digest("hex"), byteCount };
}

/** Confirm bytes on disk still hash to the expected value. */
export async function verifyEvidence(
  objectKey: string,
  expectedSha256: string,
): Promise<{ ok: boolean; actualSha256: string; byteCount: number }> {
  const { sha256, byteCount } = await rehashEvidence(objectKey);
  return { ok: sha256 === expectedSha256, actualSha256: sha256, byteCount };
}
