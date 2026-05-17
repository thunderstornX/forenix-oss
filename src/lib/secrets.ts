/**
 * Symmetric encryption for the API-key vault.
 *
 * AES-256-GCM. The key is derived from AUTH_SECRET (same secret that
 * signs the next-auth JWT) via SHA-256  -  that way there's a single
 * authoritative secret on every deployment.
 *
 * Rotating AUTH_SECRET means re-encrypting the vault (manual
 * migration); document this in the runbook.
 */
import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyMaterial(): Buffer {
  const seed = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!seed) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set before using the secrets vault.",
    );
  }
  return createHash("sha256").update(seed, "utf-8").digest();
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64 (12 bytes for GCM)
  tag: string;        // base64 (16 bytes)
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = keyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = keyMaterial();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const enc = Buffer.from(payload.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf-8");
}

/** Return a redacted preview ("sk-...1234") so the admin UI can show
 *  *that* a key is set without exposing it. */
export function preview(plaintext: string): string {
  if (plaintext.length < 8) return "...";
  return plaintext.slice(0, 3) + "..." + plaintext.slice(-4);
}
