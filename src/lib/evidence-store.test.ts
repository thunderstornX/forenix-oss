/**
 * Tests for src/lib/evidence-store.ts.
 *
 * Uses a per-test scratch dir under /tmp so we exercise the real
 * filesystem code path (atomic rename, content-address layout, dedup,
 * cap enforcement) without leaving artefacts around.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";

let scratch: string;

beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "forenix-evidence-test-"));
  process.env.FORENIX_EVIDENCE_DIR = scratch;
  // Make sure the storage helper sees us as a normal host.
  delete process.env.VERCEL;
  delete process.env.VERCEL_URL;
});

afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
});

function streamOf(bytes: Buffer): NodeJS.ReadableStream {
  return Readable.from([bytes]);
}

describe("evidence-store", () => {
  it("evidenceStorageEnabled() honours VERCEL flags", async () => {
    const { evidenceStorageEnabled } = await import("./evidence-store");
    expect(evidenceStorageEnabled()).toBe(true);
    process.env.VERCEL = "1";
    expect(evidenceStorageEnabled()).toBe(false);
    delete process.env.VERCEL;
    expect(evidenceStorageEnabled()).toBe(true);
  });

  it("stores bytes at a content-addressed path and returns the SHA-256", async () => {
    const { storeBytes, buildEvidencePath } = await import("./evidence-store");
    const payload = Buffer.from("hello forensic world", "utf-8");
    const expectedSha = createHash("sha256").update(payload).digest("hex");

    const result = await storeBytes({
      caseId: "case-abc",
      source: streamOf(payload),
    });

    expect(result.sha256).toBe(expectedSha);
    expect(result.byteCount).toBe(payload.length);
    expect(result.objectKey).toBe(
      `case-abc/${expectedSha.slice(0, 2)}/${expectedSha}`,
    );

    // The file actually exists with the right bytes.
    const path = buildEvidencePath(result.objectKey);
    const onDisk = await readFile(path);
    expect(onDisk.equals(payload)).toBe(true);
    const s = await stat(path);
    expect(s.size).toBe(payload.length);
  });

  it("deduplicates identical bytes within a case (single file on disk)", async () => {
    const { storeBytes, buildEvidencePath } = await import("./evidence-store");
    const payload = Buffer.from("dedup me", "utf-8");
    const a = await storeBytes({ caseId: "case-dedup", source: streamOf(payload) });
    const b = await storeBytes({ caseId: "case-dedup", source: streamOf(payload) });
    expect(a.objectKey).toBe(b.objectKey);
    // Still exactly one file on disk.
    const stillThere = await stat(buildEvidencePath(a.objectKey));
    expect(stillThere.size).toBe(payload.length);
  });

  it("rehashEvidence + verifyEvidence agree with the original hash", async () => {
    const { storeBytes, verifyEvidence, rehashEvidence } = await import("./evidence-store");
    const payload = Buffer.from("verify me later", "utf-8");
    const stored = await storeBytes({
      caseId: "case-verify",
      source: streamOf(payload),
    });
    const rh = await rehashEvidence(stored.objectKey);
    expect(rh.sha256).toBe(stored.sha256);
    expect(rh.byteCount).toBe(payload.length);

    const v = await verifyEvidence(stored.objectKey, stored.sha256);
    expect(v.ok).toBe(true);
    expect(v.actualSha256).toBe(stored.sha256);
  });

  it("verifyEvidence flags tampering when the stored hash disagrees", async () => {
    const { storeBytes, verifyEvidence } = await import("./evidence-store");
    const stored = await storeBytes({
      caseId: "case-tamper",
      source: streamOf(Buffer.from("a", "utf-8")),
    });
    const v = await verifyEvidence(stored.objectKey, "0".repeat(64));
    expect(v.ok).toBe(false);
    expect(v.actualSha256).toBe(stored.sha256);
  });

  it("rejects path traversal in objectKey", async () => {
    const { buildEvidencePath } = await import("./evidence-store");
    expect(() => buildEvidencePath("../../etc/passwd")).toThrow();
    expect(() => buildEvidencePath("/etc/passwd")).toThrow();
  });

  it("rejects empty uploads", async () => {
    const { storeBytes } = await import("./evidence-store");
    await expect(
      storeBytes({ caseId: "case-empty", source: streamOf(Buffer.alloc(0)) }),
    ).rejects.toThrow(/empty upload/);
  });

  it("enforces maxBytes cap", async () => {
    const { storeBytes } = await import("./evidence-store");
    const big = Buffer.alloc(2048).fill(0x41);
    await expect(
      storeBytes({
        caseId: "case-big",
        source: streamOf(big),
        maxBytes: 1024,
      }),
    ).rejects.toThrow(/exceeds maxBytes/);
  });
});
