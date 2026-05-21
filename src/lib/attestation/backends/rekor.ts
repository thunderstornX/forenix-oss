/**
 * Sigstore Rekor witness — the "purpose-built" backend.
 *
 * Rekor is a public, append-only transparency log run by the
 * Sigstore Foundation (https://rekor.sigstore.dev). It indexes
 * signed assertions and returns each one a permanent, monotonically
 * increasing `logIndex` and a UUID; anyone can later GET the entry
 * back and verify the signature against the supplied public key.
 *
 * Trust model:
 *   - Defeats the "DB admin rewrote + re-signed the chain" attack
 *     more thoroughly than [[github]]: the witness is replicated
 *     across the Sigstore network, signed-entry-timestamps are
 *     issued by Rekor's own keys, and inclusion proofs can be
 *     verified independently of us OR the maintainer.
 *   - Trust assumption shrinks to: Sigstore Foundation didn't
 *     conspire with the maintainer to forge a backdated entry.
 *
 * Implementation notes:
 *   - ECDSA P-256 keypair generated lazily on first `attest()` and
 *     persisted to disk under `REKOR_KEY_DIR` (defaults to
 *     `.attestation-keys/` next to the project root). ECDSA P-256
 *     with SHA-256 is the most-deployed combination across the
 *     Sigstore ecosystem (cosign + sigstore-python + sigstore-js
 *     all default to it), so Rekor's hashedrekord verifier path
 *     for this combination is battle-tested. We previously tried
 *     Ed25519 + SHA-512 and Rekor's verifier rejected our
 *     submissions despite local sign/verify round-tripping
 *     correctly; the ECDSA path "just works".
 *   - Signed payload is the same canonical string as the [[local]]
 *     HMAC backend uses — `"{entries}|{headId}|{headHash}|{iso}"` —
 *     so a future "audit me across all backends" tool reconstructs
 *     it once.
 *   - No external deps beyond `fetch` + `node:crypto`. Node ships
 *     ECDSA P-256 natively.
 */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type {
  AttestationBackend,
  AttestationHead,
  AttestationResult,
  AttestationVerification,
} from "../types";
import {
  buildHashedRekord,
  canonicalPayload,
  extractFromEntry,
} from "./rekor-codec";

const DEFAULT_REKOR_URL = "https://rekor.sigstore.dev";

function rekorBaseUrl(): string {
  return (process.env.REKOR_BASE_URL ?? DEFAULT_REKOR_URL).replace(/\/+$/, "");
}

function keyDir(): string {
  return resolve(
    process.env.REKOR_KEY_DIR ?? join(process.cwd(), ".attestation-keys"),
  );
}

interface KeyPair {
  publicPem: string;
  privatePem: string;
}

function ensureKeypair(): KeyPair {
  const dir = keyDir();
  const pubPath = join(dir, "rekor-ecdsa-p256.pub.pem");
  const privPath = join(dir, "rekor-ecdsa-p256.key.pem");
  if (existsSync(pubPath) && existsSync(privPath)) {
    return {
      publicPem: readFileSync(pubPath, "utf-8"),
      privatePem: readFileSync(privPath, "utf-8"),
    };
  }
  // Lazy-generate ECDSA P-256 keypair (~250 bytes PEM each).
  mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  // 0600 on the private key — same posture as the .env file.
  writeFileSync(pubPath, publicPem, { mode: 0o644 });
  writeFileSync(privPath, privatePem, { mode: 0o600 });
  return { publicPem, privatePem };
}

function b64(bytes: Buffer | string): string {
  return Buffer.from(bytes as string | Buffer).toString("base64");
}

export const rekorBackend: AttestationBackend = {
  name: "rekor",
  description:
    "Posts an ECDSA-P256-signed hashedrekord entry to Sigstore Rekor — public, append-only, independently verifiable.",

  async attest(head: AttestationHead): Promise<AttestationResult> {
    try {
      const kp = ensureKeypair();
      const payload = canonicalPayload(head);

      // SHA-256 of the canonical payload, both as the data.hash.value
      // field on the entry and as the message ECDSA signs over.
      const payloadHashHex = createHash("sha256").update(payload).digest("hex");

      // sign("sha256", buffer, key) hashes the buffer with SHA-256
      // internally and signs the digest with ECDSA. The output is
      // DER-encoded (r, s). Rekor's hashedrekord verifier expects
      // exactly this shape for an ECDSA P-256 + SHA-256 entry.
      const signature = sign("sha256", Buffer.from(payload, "utf-8"), createPrivateKey(kp.privatePem));

      const entry = buildHashedRekord({
        payloadSha256Hex: payloadHashHex,
        signatureBase64: b64(signature),
        publicKeyPemBase64: b64(kp.publicPem),
      });

      const res = await fetch(`${rekorBaseUrl()}/api/v1/log/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "forenix-oss-attestation",
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          status: "failed",
          proof: {},
          error: `rekor POST ${res.status}: ${text.slice(0, 240)}`,
        };
      }
      // Rekor returns: { "<uuid>": { logIndex, body (b64), ... } }
      const data = (await res.json()) as Record<
        string,
        { logIndex: number; logID: string; body: string; integratedTime?: number }
      >;
      const [uuid, envelope] = Object.entries(data)[0] ?? [];
      if (!uuid || !envelope) {
        return {
          status: "failed",
          proof: {},
          error: "rekor response had no entry envelope",
        };
      }
      const externalUrl = `${rekorBaseUrl()}/api/v1/log/entries/${uuid}`;
      return {
        status: "confirmed",
        externalRef: String(envelope.logIndex),
        externalUrl,
        proof: {
          uuid,
          logIndex: envelope.logIndex,
          logID: envelope.logID,
          integratedTime: envelope.integratedTime,
          // Keep our local copy of the signature material so the
          // verify path doesn't depend on re-decoding the body.
          payloadSha256: payloadHashHex,
          publicKeyPem: kp.publicPem,
          signatureBase64: b64(signature),
          rekorBaseUrl: rekorBaseUrl(),
        },
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
      const uuid = typeof proof.uuid === "string" ? proof.uuid : "";
      if (!uuid) return { ok: false, details: "no rekor uuid in proof" };
      const base =
        typeof proof.rekorBaseUrl === "string" ? proof.rekorBaseUrl : rekorBaseUrl();

      const res = await fetch(`${base}/api/v1/log/entries/${uuid}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "forenix-oss-attestation",
        },
      });
      if (!res.ok) {
        return {
          ok: false,
          details: `rekor GET ${res.status} — entry may have rotated or been retired`,
        };
      }
      const data = (await res.json()) as Record<string, { body: string }>;
      const envelope = data[uuid];
      if (!envelope?.body) {
        return { ok: false, details: "rekor entry envelope missing body" };
      }
      const decoded = JSON.parse(
        Buffer.from(envelope.body, "base64").toString("utf-8"),
      ) as unknown;
      const extracted = extractFromEntry(decoded);
      if (!extracted) {
        return { ok: false, details: "rekor body did not decode to a hashedrekord" };
      }

      // 1. The hash inside the rekor entry must match the SHA-256 of
      //    the head we're being asked to verify.
      const expectedHashHex = createHash("sha256")
        .update(canonicalPayload(head))
        .digest("hex");
      if (extracted.payloadSha256Hex !== expectedHashHex) {
        return {
          ok: false,
          details: "rekor entry pins a different head — chain may have been rewritten",
        };
      }

      // 2. The signature inside the entry must verify against the
      //    public key inside the same entry, over the canonical
      //    payload bytes (sign/verify both hash internally with
      //    SHA-256 via the algorithm parameter).
      const pubPem = Buffer.from(extracted.publicKeyPemBase64, "base64").toString(
        "utf-8",
      );
      const sigBytes = Buffer.from(extracted.signatureBase64, "base64");
      const verified = verify(
        "sha256",
        Buffer.from(canonicalPayload(head), "utf-8"),
        createPublicKey(pubPem),
        sigBytes,
      );
      if (!verified) {
        return {
          ok: false,
          details: "rekor entry signature does not verify against its own public key",
        };
      }
      return {
        ok: true,
        details: `rekor entry ${uuid.slice(0, 8)}... still pins this head and the signature verifies`,
      };
    } catch (e) {
      return { ok: false, details: (e as Error).message };
    }
  },
};
