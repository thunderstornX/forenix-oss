/**
 * Pure-function tests for the Rekor codec.
 *
 * The HTTP path is exercised live (operator runs "Attest now" with
 * backend=rekor); here we only test the canonical payload shape +
 * the hashedrekord entry builder + the response-body extractor.
 */
import { describe, expect, it } from "bun:test";

import {
  buildHashedRekord,
  canonicalPayload,
  extractFromEntry,
  type RekorHead,
} from "./rekor-codec";

function head(over: Partial<RekorHead> = {}): RekorHead {
  return {
    entries: 5,
    headId: "ck-head-1",
    headHash: "a".repeat(64),
    attestedAt: new Date("2026-05-17T16:25:57.510Z"),
    ...over,
  };
}

describe("attestation/backends/rekor codec", () => {
  it("canonicalPayload is stable + pipe-delimited", () => {
    expect(canonicalPayload(head())).toBe(
      "5|ck-head-1|" + "a".repeat(64) + "|2026-05-17T16:25:57.510Z",
    );
  });

  it("canonicalPayload changes on any single-field change", () => {
    const base = canonicalPayload(head());
    expect(canonicalPayload(head({ entries: 6 }))).not.toBe(base);
    expect(canonicalPayload(head({ headId: "ck-head-2" }))).not.toBe(base);
    expect(canonicalPayload(head({ headHash: "b" + "a".repeat(63) }))).not.toBe(base);
    expect(
      canonicalPayload(head({ attestedAt: new Date("2026-05-17T16:25:57.511Z") })),
    ).not.toBe(base);
  });

  it("buildHashedRekord emits the v0.0.1 envelope shape rekor expects", () => {
    const entry = buildHashedRekord({
      payloadSha512Hex: "f".repeat(128),
      signatureBase64: "c2lnLWJ5dGVz",
      publicKeyPemBase64: "cGstYnl0ZXM=",
    });
    expect(entry.apiVersion).toBe("0.0.1");
    expect(entry.kind).toBe("hashedrekord");
    expect(entry.spec.data.hash.algorithm).toBe("sha512");
    expect(entry.spec.data.hash.value).toBe("f".repeat(128));
    expect(entry.spec.signature.content).toBe("c2lnLWJ5dGVz");
    expect(entry.spec.signature.publicKey.content).toBe("cGstYnl0ZXM=");
  });

  it("extractFromEntry round-trips a body shaped like Rekor's response", () => {
    const entry = buildHashedRekord({
      payloadSha512Hex: "1".repeat(128),
      signatureBase64: "sig",
      publicKeyPemBase64: "pk",
    });
    const got = extractFromEntry(entry);
    expect(got).not.toBeNull();
    expect(got!.payloadSha512Hex).toBe("1".repeat(128));
    expect(got!.signatureBase64).toBe("sig");
    expect(got!.publicKeyPemBase64).toBe("pk");
  });

  it("extractFromEntry returns null on garbage", () => {
    expect(extractFromEntry(null)).toBeNull();
    expect(extractFromEntry({})).toBeNull();
    expect(extractFromEntry({ spec: {} })).toBeNull();
    expect(
      extractFromEntry({
        spec: { signature: { content: "x", publicKey: { content: "y" } } },
      }),
    ).toBeNull();
    expect(
      extractFromEntry({
        spec: {
          signature: { content: "x", publicKey: { content: "y" } },
          data: { hash: { algorithm: "sha256" } },
        },
      }),
    ).toBeNull();
  });
});
