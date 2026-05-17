/**
 * Attestation backend contract.
 *
 * An attestation backend takes a snapshot of the audit chain's
 * current head — `{entries, headId, headHash, attestedAt}` — and
 * commits it to *somewhere the maintainer can't unilaterally
 * rewrite*. Later, `verify()` reads the commitment back from that
 * somewhere and checks it still matches the supplied head.
 *
 * The point of having a contract: future witnesses (Rekor,
 * OpenTimestamps, a Discord webhook, the public-square noticeboard
 * outside your local council building) drop in without touching the
 * schema, the API surface, or the UI. Only the `proof` JSON shape
 * is backend-specific.
 *
 * Conceptual escape hatches we don't take but you might:
 *   - asynchronous confirmation: backends could return `submitted`
 *     now + a way to poll for `confirmed` later. The schema supports
 *     this via the `confirmedAt` column. Today's backends all return
 *     a synchronous verdict (`confirmed` or `failed`).
 *   - signing key per backend: today the only key in scope is the
 *     local HMAC over AUTH_SECRET. A future Sigstore-cosign backend
 *     would carry its own keyring.
 */
import "server-only";

export interface AttestationHead {
  /** Total AuditLog rows at the moment of attestation. */
  entries: number;
  /** The tip row's id (cuid). */
  headId: string;
  /** SHA-256 hex of the tip row (the value being witnessed). */
  headHash: string;
  /** The moment we sampled the head. ISO date used inside proofs. */
  attestedAt: Date;
}

export interface AttestationResult {
  status: "submitted" | "confirmed" | "failed";
  /** Backend-native identifier (comment id, log index, ots digest, ...). */
  externalRef?: string;
  /** Human-clickable URL where the witness can be read back. */
  externalUrl?: string;
  /** Opaque-to-the-caller payload the backend needs to re-verify. */
  proof: Record<string, unknown>;
  /** Populated when status === "failed". */
  error?: string;
}

export interface AttestationVerification {
  ok: boolean;
  /** Short, human-readable explanation (used in the UI on hover). */
  details?: string;
}

export interface AttestationBackend {
  /** Stable identifier persisted in `Attestation.backend`. */
  readonly name: string;
  /** What gets shown in the UI / docs. */
  readonly description: string;
  /** Submit the head to the external witness. */
  attest(head: AttestationHead): Promise<AttestationResult>;
  /** Re-fetch the witness and confirm it still pins this head. */
  verify(
    head: AttestationHead,
    proof: Record<string, unknown>,
  ): Promise<AttestationVerification>;
}

export type AttestationBackendName = "local" | "github" | "rekor";
