/**
 * Attestation orchestration — the only path the API routes use.
 *
 * `runAttestation()`:
 *   1. Reads the audit chain's current head + total row count.
 *   2. Calls the configured (or named) backend's `attest()`.
 *   3. Persists the Attestation row.
 *   4. Appends an `attest_chain` row to the audit log so the act of
 *      attesting is itself notarised by the next attestation.
 *
 * `verifyAttestation()`:
 *   1. Loads the stored row + its proof JSON.
 *   2. Asks the matching backend to re-verify.
 *   3. Returns the verdict (does NOT mutate the row — verification is
 *      a read; UI can call it as often as it likes).
 *
 * The split keeps the API routes thin: they handle auth + JSON
 * shape, this handles everything that touches the chain.
 */
import "server-only";

import { appendAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

import { getAttestationBackend, getAttestationBackendByName } from "./factory";
import type {
  AttestationBackend,
  AttestationHead,
  AttestationVerification,
} from "./types";

export interface RunAttestationOptions {
  /** Optional backend override (per-request); falls back to env default. */
  backend?: string;
  /** Audit-log actor id; null = system-initiated. */
  actorId?: string | null;
  /**
   * Inject a backend directly. Tests use this to avoid hitting the
   * factory / env layer. Routes never pass it.
   */
  backendInstance?: AttestationBackend;
}

export async function captureHead(): Promise<AttestationHead> {
  const head = await prisma.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, hash: true },
  });
  const entries = await prisma.auditLog.count();
  return {
    entries,
    headId: head?.id ?? "GENESIS",
    headHash: head?.hash ?? "0".repeat(64),
    attestedAt: new Date(),
  };
}

export async function runAttestation(opts: RunAttestationOptions = {}) {
  const backend: AttestationBackend =
    opts.backendInstance ??
    (opts.backend ? getAttestationBackendByName(opts.backend) : getAttestationBackend());

  const head = await captureHead();
  const result = await backend.attest(head);

  const row = await prisma.attestation.create({
    data: {
      entries: head.entries,
      headId: head.headId,
      headHash: head.headHash,
      backend: backend.name,
      status: result.status,
      proof: JSON.stringify(result.proof),
      externalRef: result.externalRef ?? null,
      externalUrl: result.externalUrl ?? null,
      error: result.error ?? null,
      createdAt: head.attestedAt,
      confirmedAt: result.status === "confirmed" ? head.attestedAt : null,
    },
  });

  // Even failed attestations get an audit row so a long sequence of
  // backend failures shows up in the chain history rather than being
  // silently dropped. The chain has its own meta-witness this way.
  await appendAudit({
    action: "attest_chain",
    entity: "Attestation",
    entityId: row.id,
    userId: opts.actorId ?? null,
    details: {
      backend: backend.name,
      status: result.status,
      entries: head.entries,
      headHash: head.headHash,
      externalRef: result.externalRef,
    },
  });

  return row;
}

export async function verifyAttestation(
  id: string,
): Promise<{ row: Awaited<ReturnType<typeof prisma.attestation.findUnique>>; verdict: AttestationVerification }> {
  const row = await prisma.attestation.findUnique({ where: { id } });
  if (!row) {
    return {
      row: null,
      verdict: { ok: false, details: "attestation not found" },
    };
  }
  const backend = getAttestationBackendByName(row.backend);
  const head: AttestationHead = {
    entries: row.entries,
    headId: row.headId,
    headHash: row.headHash,
    attestedAt: row.createdAt,
  };
  let proof: Record<string, unknown>;
  try {
    proof = JSON.parse(row.proof) as Record<string, unknown>;
  } catch {
    return {
      row,
      verdict: { ok: false, details: "proof JSON is unparseable" },
    };
  }
  const verdict = await backend.verify(head, proof);
  return { row, verdict };
}
