/**
 * Local HMAC witness — the "always-available" backend.
 *
 * Mechanism: HMAC-SHA256( AUTH_SECRET, "{entries}|{headId}|{headHash}|{iso(attestedAt)}" ).
 * The HMAC is stored alongside the head in the Attestation row.
 * Verification recomputes it from the same head + the same secret.
 *
 * What this DOES buy you:
 *   - A signed, append-only record that the chain looked thus-and-so
 *     at this moment, signed by something other than the chain itself.
 *   - Deterministic, offline-verifiable. Same recipe as the audit
 *     chain — three lines of Python given the secret.
 *   - Catches accidental DB corruption + naive tampering (rewriting
 *     a row without recomputing the local witness leaves a divergent
 *     signature).
 *
 * What this DOES NOT buy you:
 *   - Defence against an attacker who can read AUTH_SECRET. They can
 *     forge a new local witness to match whatever forged chain they
 *     please. For *that* threat model use [[github]] (or, later, a
 *     Rekor / OpenTimestamps backend) where the witnessing system is
 *     outside the attacker's perimeter.
 *
 * In other words: this is the "did the disk go funny?" witness, not
 * the "did the DB admin get bribed?" witness. We ship it as the
 * default so the entire attestation pipeline — schema, service, UI —
 * works out-of-the-box on every install, including the Vercel demo.
 *
 * No `import "server-only"` here on purpose: the `node:crypto` import
 * already keeps this out of client bundles, and bun:test (which our
 * pure-function tests run under) treats "server-only" as a client
 * context and throws. Same trade-off applied to evidence-store +
 * git-engine.
 */
import { createHmac } from "node:crypto";

import type {
  AttestationBackend,
  AttestationHead,
  AttestationResult,
  AttestationVerification,
} from "../types";

function getSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (!s) {
    throw new Error(
      "local attestation backend requires AUTH_SECRET (or NEXTAUTH_SECRET) to be set",
    );
  }
  return s;
}

export function signHead(head: AttestationHead, secret: string): string {
  // Single canonical encoding — pipe-delimited, ISO-8601 timestamps —
  // matches the audit chain's encoding rhythm so the python recipe
  // stays short.
  const payload = [
    String(head.entries),
    head.headId,
    head.headHash,
    head.attestedAt.toISOString(),
  ].join("|");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export const localBackend: AttestationBackend = {
  name: "local",
  description:
    "HMAC-SHA256 over the chain head, keyed on AUTH_SECRET. Offline-verifiable; not external.",

  async attest(head: AttestationHead): Promise<AttestationResult> {
    try {
      const signature = signHead(head, getSecret());
      return {
        status: "confirmed",
        externalRef: signature.slice(0, 16),
        proof: { algo: "HMAC-SHA256", signature },
      };
    } catch (e) {
      return {
        status: "failed",
        proof: {},
        error: (e as Error).message,
      };
    }
  },

  async verify(
    head: AttestationHead,
    proof: Record<string, unknown>,
  ): Promise<AttestationVerification> {
    try {
      const stored = typeof proof.signature === "string" ? proof.signature : "";
      if (!stored) return { ok: false, details: "no signature in proof" };
      const expected = signHead(head, getSecret());
      const ok = constantTimeEquals(stored, expected);
      return ok
        ? { ok: true, details: "HMAC matches the recomputed head" }
        : { ok: false, details: "HMAC mismatch — head was modified or secret rotated" };
    } catch (e) {
      return { ok: false, details: (e as Error).message };
    }
  },
};

// Both inputs are hex strings of the same length on the happy path,
// but a defensive equal-length check keeps us from leaking via early
// return on length mismatch.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
