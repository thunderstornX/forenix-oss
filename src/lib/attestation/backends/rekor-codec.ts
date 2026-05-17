/**
 * Pure codec for Sigstore Rekor entries — split out so bun:test can
 * import the encoding helpers without dragging in `server-only` or
 * filesystem keypair I/O.
 *
 * The entry we submit is the simplest Rekor type, `hashedrekord/0.0.1`:
 *
 *   {
 *     "apiVersion": "0.0.1",
 *     "kind": "hashedrekord",
 *     "spec": {
 *       "signature": {
 *         "content":   <base64 of Ed25519(sig over the payload-hash)>,
 *         "publicKey": { "content": <base64 of PEM SPKI public key> }
 *       },
 *       "data": {
 *         "hash": { "algorithm": "sha256", "value": <hex of payload sha256> }
 *       }
 *     }
 *   }
 *
 * The "payload" we hash is a canonical encoding of the audit-chain
 * head:
 *
 *   "{entries}|{headId}|{headHash}|{iso(attestedAt)}"
 *
 * Same shape as the [[local]] HMAC payload, so a future "audit me
 * across all backends" tool can canonically reconstruct it once.
 *
 * Why publish the public key inside the entry? Rekor stores it
 * verbatim — anyone fetching the entry can verify the signature
 * without trusting us to have published the pubkey separately.
 */

export interface RekorHead {
  entries: number;
  headId: string;
  headHash: string;
  attestedAt: Date;
}

export function canonicalPayload(head: RekorHead): string {
  return [
    String(head.entries),
    head.headId,
    head.headHash,
    head.attestedAt.toISOString(),
  ].join("|");
}

export interface HashedRekord {
  apiVersion: "0.0.1";
  kind: "hashedrekord";
  spec: {
    signature: {
      content: string;
      publicKey: { content: string };
    };
    data: {
      hash: { algorithm: "sha256"; value: string };
    };
  };
}

export function buildHashedRekord(args: {
  payloadSha256Hex: string;
  signatureBase64: string;
  publicKeyPemBase64: string;
}): HashedRekord {
  return {
    apiVersion: "0.0.1",
    kind: "hashedrekord",
    spec: {
      signature: {
        content: args.signatureBase64,
        publicKey: { content: args.publicKeyPemBase64 },
      },
      data: {
        hash: { algorithm: "sha256", value: args.payloadSha256Hex },
      },
    },
  };
}

/**
 * Pull our payload-hash and signature back out of a Rekor entry's
 * decoded body. Tolerant of the slight shape variations Rekor's
 * different versions return — we only require the fields we use.
 */
export function extractFromEntry(body: unknown): {
  payloadSha256Hex: string;
  signatureBase64: string;
  publicKeyPemBase64: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as {
    spec?: {
      signature?: { content?: string; publicKey?: { content?: string } };
      data?: { hash?: { algorithm?: string; value?: string } };
    };
  };
  const sigContent = b.spec?.signature?.content;
  const pkContent = b.spec?.signature?.publicKey?.content;
  const hashValue = b.spec?.data?.hash?.value;
  if (
    typeof sigContent !== "string" ||
    typeof pkContent !== "string" ||
    typeof hashValue !== "string"
  ) {
    return null;
  }
  return {
    payloadSha256Hex: hashValue,
    signatureBase64: sigContent,
    publicKeyPemBase64: pkContent,
  };
}
