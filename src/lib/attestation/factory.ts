/**
 * Attestation backend factory.
 *
 * `getAttestationBackend()` returns the default backend selected via
 * the `ATTESTATION_BACKEND` env var. Missing or unrecognised values
 * fall back to `local` — the always-available "did the disk go funny"
 * witness — so the attestation pipeline never silently 500s on a
 * mis-typed config.
 *
 * `getAttestationBackendByName()` is the per-request override path:
 * the admin "Attest now" button can pass `?backend=github` to attest
 * with a different witness without restarting the process.
 */
import "server-only";

import type { AttestationBackend, AttestationBackendName } from "./types";
import { localBackend } from "./backends/local";
import { githubBackend } from "./backends/github";
import { rekorBackend } from "./backends/rekor";

const REGISTRY: Record<AttestationBackendName, AttestationBackend> = {
  local: localBackend,
  github: githubBackend,
  rekor: rekorBackend,
};

export function listAttestationBackends(): AttestationBackend[] {
  return Object.values(REGISTRY);
}

export function getAttestationBackendByName(name: string): AttestationBackend {
  const hit = REGISTRY[name as AttestationBackendName];
  return hit ?? localBackend;
}

export function getAttestationBackend(): AttestationBackend {
  return getAttestationBackendByName(process.env.ATTESTATION_BACKEND ?? "local");
}
