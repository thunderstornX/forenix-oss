/**
 * GitHub-issue-comment witness.
 *
 * Mechanism: POST a JSON comment to a designated GitHub issue. The
 * comment id + URL are persisted as the proof. Verification re-fetches
 * the comment body and confirms the head still matches.
 *
 * Configuration (env):
 *   ATTEST_GITHUB_TOKEN   — PAT with `public_repo` (or `repo` for
 *                            private witnesses). Read+write on issues.
 *   ATTEST_GITHUB_OWNER   — repo owner, e.g., "thunderstornX"
 *   ATTEST_GITHUB_REPO    — repo name, e.g., "forenix-oss-witness"
 *   ATTEST_GITHUB_ISSUE   — issue number to use as the witness log
 *                            (a single, ideally pinned + locked issue)
 *
 * Threat model:
 *   - Strictly better than [[local]] for the "DB admin re-signed the
 *     chain" scenario: the maintainer would also have to forge the
 *     GitHub-issue comment, and GitHub keeps an *edit history* on
 *     every comment that's visible to anyone with read access. So
 *     tampering becomes detectable (you can see the comment was
 *     edited after the fact), not impossible.
 *   - Still trusts: GitHub didn't conspire with the maintainer. To
 *     close THAT gap, swap in a Sigstore Rekor or OpenTimestamps
 *     backend later — same contract, no schema change.
 *
 * Why not Octokit? Adds 200kB of dependency for two REST calls. The
 * rest of forenix-oss uses plain `fetch` against external services
 * (see chat-completions.ts) — we follow that pattern.
 */
import "server-only";

import type {
  AttestationBackend,
  AttestationHead,
  AttestationResult,
  AttestationVerification,
} from "../types";
import { buildBody, extractEnvelope } from "./github-codec";

interface GhConfig {
  token: string;
  owner: string;
  repo: string;
  issue: number;
}

function readConfig(): GhConfig {
  const token = process.env.ATTEST_GITHUB_TOKEN ?? "";
  const owner = process.env.ATTEST_GITHUB_OWNER ?? "";
  const repo = process.env.ATTEST_GITHUB_REPO ?? "";
  const issue = Number(process.env.ATTEST_GITHUB_ISSUE ?? "");
  if (!token || !owner || !repo || !Number.isInteger(issue) || issue <= 0) {
    throw new Error(
      "github attestation backend requires ATTEST_GITHUB_TOKEN, _OWNER, _REPO, and _ISSUE",
    );
  }
  return { token, owner, repo, issue };
}

const ACCEPT = "application/vnd.github+json";
const API_VERSION = "2022-11-28";

export const githubBackend: AttestationBackend = {
  name: "github",
  description:
    "Posts the chain head as a comment on a designated GitHub issue. GitHub's per-comment edit history makes tampering publicly detectable.",

  async attest(head: AttestationHead): Promise<AttestationResult> {
    try {
      const cfg = readConfig();
      const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/issues/${cfg.issue}/comments`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          Accept: ACCEPT,
          "X-GitHub-Api-Version": API_VERSION,
          "Content-Type": "application/json",
          "User-Agent": "forenix-oss-attestation",
        },
        body: JSON.stringify({ body: buildBody(head) }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          status: "failed",
          proof: {},
          error: `github POST ${res.status}: ${text.slice(0, 240)}`,
        };
      }
      const data = (await res.json()) as { id: number; html_url: string };
      return {
        status: "confirmed",
        externalRef: String(data.id),
        externalUrl: data.html_url,
        proof: {
          commentId: data.id,
          htmlUrl: data.html_url,
          owner: cfg.owner,
          repo: cfg.repo,
          issue: cfg.issue,
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
      const cfg = readConfig();
      const commentId = proof.commentId;
      if (typeof commentId !== "number" && typeof commentId !== "string") {
        return { ok: false, details: "no commentId in proof" };
      }
      const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/issues/comments/${commentId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          Accept: ACCEPT,
          "X-GitHub-Api-Version": API_VERSION,
          "User-Agent": "forenix-oss-attestation",
        },
      });
      if (!res.ok) {
        return {
          ok: false,
          details: `github GET ${res.status} — comment may have been deleted`,
        };
      }
      const data = (await res.json()) as {
        body: string;
        updated_at?: string;
        created_at?: string;
      };
      const env = extractEnvelope(data.body ?? "");
      if (!env) return { ok: false, details: "comment body lost its attestation envelope" };
      const matches =
        env.entries === head.entries &&
        env.headId === head.headId &&
        env.headHash === head.headHash;
      if (!matches) {
        return {
          ok: false,
          details: "comment envelope no longer matches the head — chain or comment was modified",
        };
      }
      const edited =
        data.updated_at && data.created_at && data.updated_at !== data.created_at;
      return {
        ok: true,
        details: edited
          ? "comment matches but has been edited since posting — review edit history"
          : "comment matches the head and shows no edit history",
      };
    } catch (e) {
      return { ok: false, details: (e as Error).message };
    }
  },
};

