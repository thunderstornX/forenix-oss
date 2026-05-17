/**
 * Pure JSON codec for the GitHub-attestation envelope.
 *
 * Split out from `./github.ts` so it can be imported under `bun:test`
 * — the wrapper module pulls in `server-only`, which bun's test
 * runner treats as a client-context import and throws.
 *
 * Same trade-off applied to git-engine + evidence-store: keep the
 * pure-data parts importable everywhere; keep the I/O parts marked
 * server-only.
 */
export interface CommentEnvelope {
  forenix_attestation: 1;
  entries: number;
  headId: string;
  headHash: string;
  attestedAt: string;
  note: string;
}

export interface CodecHead {
  entries: number;
  headId: string;
  headHash: string;
  attestedAt: Date;
}

export function buildBody(head: CodecHead): string {
  const env: CommentEnvelope = {
    forenix_attestation: 1,
    entries: head.entries,
    headId: head.headId,
    headHash: head.headHash,
    attestedAt: head.attestedAt.toISOString(),
    note: "External attestation of the forenix-oss audit chain head. Tampering with this comment leaves a public edit-history record.",
  };
  return [
    "**forenix-oss audit-chain attestation**",
    "",
    "```json",
    JSON.stringify(env, null, 2),
    "```",
  ].join("\n");
}

export function extractEnvelope(commentBody: string): CommentEnvelope | null {
  const match = commentBody.match(/```json\s*([\s\S]+?)\s*```/);
  const raw = match?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { forenix_attestation?: number }).forenix_attestation === 1
    ) {
      return parsed as CommentEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}
