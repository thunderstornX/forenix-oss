/**
 * Pure-function tests for the audit hash chain.
 *
 * Run via `bun test`. Zero Prisma, zero network, zero LLM  -  just
 * the SHA-256 chain math.
 */
import { describe, it, expect } from "bun:test";

import { computeAuditHash, GENESIS_HASH } from "./audit-chain";

const FIXED_DATE = new Date("2026-05-13T12:00:00.000Z");

describe("audit-chain", () => {
  it("GENESIS_HASH is 32 zero bytes hex-encoded", () => {
    expect(GENESIS_HASH).toBe("0".repeat(64));
    expect(GENESIS_HASH).toHaveLength(64);
  });

  it("computeAuditHash returns a 64-char hex string", () => {
    const h = computeAuditHash({
      prevHash: GENESIS_HASH,
      action: "create_investigation",
      entity: "Investigation",
      entityId: "abc",
      createdAt: FIXED_DATE,
    });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic given the same inputs", () => {
    const args = {
      prevHash: GENESIS_HASH,
      action: "verify_finding",
      entity: "Finding",
      entityId: "xyz",
      createdAt: FIXED_DATE,
    };
    expect(computeAuditHash(args)).toBe(computeAuditHash(args));
  });

  it("changes if any input changes (avalanche)", () => {
    const base = {
      prevHash: GENESIS_HASH,
      action: "verify_finding",
      entity: "Finding",
      entityId: "xyz",
      createdAt: FIXED_DATE,
    };
    const baseline = computeAuditHash(base);
    expect(computeAuditHash({ ...base, action: "VERIFY_FINDING" })).not.toBe(baseline);
    expect(computeAuditHash({ ...base, entity: "finding" })).not.toBe(baseline);
    expect(computeAuditHash({ ...base, entityId: "xyz " })).not.toBe(baseline);
    expect(computeAuditHash({ ...base, createdAt: new Date(FIXED_DATE.getTime() + 1) })).not.toBe(baseline);
  });

  it("prevHash is mixed into the digest", () => {
    const a = computeAuditHash({
      prevHash: GENESIS_HASH,
      action: "x", entity: "y", entityId: "z",
      createdAt: FIXED_DATE,
    });
    const b = computeAuditHash({
      prevHash: "1".repeat(64),
      action: "x", entity: "y", entityId: "z",
      createdAt: FIXED_DATE,
    });
    expect(a).not.toBe(b);
  });

  it("chain replay across multiple rows is stable", () => {
    const rows = [
      { action: "create_user", entity: "User",          entityId: "u1" },
      { action: "create_inv",  entity: "Investigation", entityId: "i1" },
      { action: "run_pipe",    entity: "Investigation", entityId: "i1" },
      { action: "create_case", entity: "Case",          entityId: "c1" },
    ];
    let prev = GENESIS_HASH;
    const t0 = FIXED_DATE.getTime();
    const hashes: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const h = computeAuditHash({
        prevHash: prev,
        action: rows[i]!.action,
        entity: rows[i]!.entity,
        entityId: rows[i]!.entityId,
        createdAt: new Date(t0 + i * 1000),
      });
      hashes.push(h);
      prev = h;
    }

    // Each hash must be unique.
    expect(new Set(hashes).size).toBe(rows.length);

    // Re-running the same sequence produces the same chain.
    let prev2 = GENESIS_HASH;
    for (let i = 0; i < rows.length; i++) {
      const h = computeAuditHash({
        prevHash: prev2,
        action: rows[i]!.action,
        entity: rows[i]!.entity,
        entityId: rows[i]!.entityId,
        createdAt: new Date(t0 + i * 1000),
      });
      expect(h).toBe(hashes[i]);
      prev2 = h;
    }
  });

  it("flipping a middle row's action breaks every subsequent hash", () => {
    const rows = [
      { action: "a", entity: "X", entityId: "1" },
      { action: "b", entity: "X", entityId: "1" },
      { action: "c", entity: "X", entityId: "1" },
    ];
    const baseline = chainFor(rows);
    const tampered = chainFor([
      rows[0]!,
      { ...rows[1]!, action: "bb" },
      rows[2]!,
    ]);
    expect(baseline[0]).toBe(tampered[0]);
    expect(baseline[1]).not.toBe(tampered[1]);
    expect(baseline[2]).not.toBe(tampered[2]);
  });

  // Regression: the security doc and README both claim the chain is
  // verifiable offline with the literal Python recipe documented in
  // docs/07-SECURITY.md. This test reproduces that recipe byte-for-byte
  // and asserts it agrees with the TS implementation. If anyone tightens
  // the input format in `computeAuditHash` without updating the Python
  // recipe, this test fires.
  it("matches the documented Python offline-verifier recipe", async () => {
    const { createHash } = await import("node:crypto");
    function pythonRecipe(args: {
      prevHash: string; action: string; entity: string;
      entityId: string; createdAt: Date;
    }): string {
      // Replicates the recipe quoted in docs/07-SECURITY.md + the README:
      //   sha256( prevHash | action | entity | entityId | iso(createdAt) )
      const parts = [
        args.prevHash,
        args.action,
        args.entity,
        args.entityId,
        args.createdAt.toISOString(),
      ];
      return createHash("sha256").update(parts.join("|")).digest("hex");
    }

    const inputs = [
      { prevHash: GENESIS_HASH, action: "create_user", entity: "User", entityId: "u1", createdAt: FIXED_DATE },
      { prevHash: "f".repeat(64), action: "verify_finding", entity: "Finding", entityId: "abc-123", createdAt: new Date("2026-06-01T00:00:00.000Z") },
      { prevHash: "1".repeat(64), action: "seal_evidence", entity: "Evidence", entityId: "", createdAt: FIXED_DATE },
    ];
    for (const args of inputs) {
      expect(computeAuditHash(args)).toBe(pythonRecipe(args));
    }
  });
});

function chainFor(
  rows: { action: string; entity: string; entityId: string }[],
): string[] {
  let prev = GENESIS_HASH;
  const t0 = FIXED_DATE.getTime();
  return rows.map((r, i) => {
    const h = computeAuditHash({
      prevHash: prev,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      createdAt: new Date(t0 + i * 1000),
    });
    prev = h;
    return h;
  });
}
