/**
 * Pure-function tests for the local HMAC attestation backend.
 * Runs under bun:test with no Prisma, no network, no LLM.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import type { AttestationHead } from "../types";
import { localBackend, signHead } from "./local";

const FIXED_DATE = new Date("2026-05-17T12:34:56.000Z");

function freshHead(over: Partial<AttestationHead> = {}): AttestationHead {
  return {
    entries: 42,
    headId: "ckxabc123",
    headHash: "a".repeat(64),
    attestedAt: FIXED_DATE,
    ...over,
  };
}

let savedSecret: string | undefined;

beforeEach(() => {
  savedSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-please-do-not-use-in-prod";
});
afterEach(() => {
  if (savedSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = savedSecret;
});

describe("attestation/backends/local", () => {
  it("signHead is deterministic for identical inputs", () => {
    const head = freshHead();
    expect(signHead(head, "secret")).toBe(signHead(head, "secret"));
  });

  it("signHead returns a 64-char hex digest", () => {
    expect(signHead(freshHead(), "secret")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signHead changes on any single-byte input change (avalanche)", () => {
    const base = freshHead();
    const baseline = signHead(base, "secret");
    expect(signHead({ ...base, entries: 43 }, "secret")).not.toBe(baseline);
    expect(signHead({ ...base, headId: "ckxabc124" }, "secret")).not.toBe(baseline);
    expect(signHead({ ...base, headHash: "b" + base.headHash.slice(1) }, "secret"))
      .not.toBe(baseline);
    expect(
      signHead({ ...base, attestedAt: new Date(FIXED_DATE.getTime() + 1) }, "secret"),
    ).not.toBe(baseline);
  });

  it("signHead is keyed — same head, different secret => different digest", () => {
    expect(signHead(freshHead(), "a")).not.toBe(signHead(freshHead(), "b"));
  });

  it("attest() round-trips with verify() on the happy path", async () => {
    const head = freshHead();
    const result = await localBackend.attest(head);
    expect(result.status).toBe("confirmed");
    expect(result.externalRef).toMatch(/^[0-9a-f]{16}$/);
    expect((result.proof as { signature?: string }).signature).toMatch(/^[0-9a-f]{64}$/);

    const verdict = await localBackend.verify(head, result.proof);
    expect(verdict.ok).toBe(true);
  });

  it("verify() rejects a head whose entries field was tampered with", async () => {
    const head = freshHead();
    const result = await localBackend.attest(head);

    const verdict = await localBackend.verify({ ...head, entries: 41 }, result.proof);
    expect(verdict.ok).toBe(false);
    expect(verdict.details).toMatch(/mismatch/i);
  });

  it("verify() rejects a head whose hash was tampered with", async () => {
    const head = freshHead();
    const result = await localBackend.attest(head);

    const verdict = await localBackend.verify(
      { ...head, headHash: "f".repeat(64) },
      result.proof,
    );
    expect(verdict.ok).toBe(false);
  });

  it("verify() rejects after a secret rotation", async () => {
    const head = freshHead();
    const result = await localBackend.attest(head);
    process.env.AUTH_SECRET = "rotated-secret-now";
    const verdict = await localBackend.verify(head, result.proof);
    expect(verdict.ok).toBe(false);
  });

  it("verify() rejects an empty / malformed proof", async () => {
    const head = freshHead();
    expect((await localBackend.verify(head, {})).ok).toBe(false);
    expect((await localBackend.verify(head, { signature: "not-hex" })).ok).toBe(false);
  });

  it("attest() returns status=failed when AUTH_SECRET is missing", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    const result = await localBackend.attest(freshHead());
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/AUTH_SECRET/);
  });

  it("falls back to NEXTAUTH_SECRET when AUTH_SECRET is unset", async () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "fallback-secret";
    try {
      const result = await localBackend.attest(freshHead());
      expect(result.status).toBe("confirmed");
    } finally {
      delete process.env.NEXTAUTH_SECRET;
    }
  });
});
