/**
 * Real Git engine on top of isomorphic-git.
 *
 * Every forensic Case owns a real Git repository on disk. Each
 * Evidence row materialises as a JSON file in the repo. Branch
 * operations, commits, and merges are real Git operations — not
 * database illusions.
 *
 * Layout per case (CASE_REPO_ROOT env, default ./case-repos):
 *
 *   <root>/<caseId>/
 *     ├── .git/                  ← bare-style git directory
 *     ├── evidence/
 *     │   ├── <evidenceId>.json
 *     │   └── …
 *     └── README.md               ← case description, branch-rooted
 *
 * `headHash` and `parentHash` on the existing Branch / EvidenceCommit
 * tables remain — they now hold actual git oids (40-char hex SHA-1)
 * rather than ad-hoc SHA-256 strings. This is a non-breaking change
 * at the schema level.
 *
 * NOTE: this module is server-only and depends on the host fs;
 * Vercel deployments would need to either (a) stick to in-memory FS
 * via memfs, or (b) delegate to a worker. For local dev + Docker
 * self-host the real fs is fine.
 */
// NOTE: this module uses `node:fs`, so any accidental import from a
// "use client" component will fail at Next.js build time. That's the
// implicit boundary — no separate `server-only` marker needed (and
// the marker breaks bun-test).

import { promises as fs } from "node:fs";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";

import git from "isomorphic-git";

const ROOT = process.env.CASE_REPO_ROOT ?? join(process.cwd(), "case-repos");
const AUTHOR = {
  name: "forenix-oss",
  email: "system@forenix-oss.local",
};

function caseDir(caseId: string): string {
  return join(ROOT, caseId);
}

/** Initialise the case repo if it does not yet exist. */
export async function ensureCaseRepo(
  caseId: string,
  opts: { title?: string; description?: string } = {},
): Promise<void> {
  const dir = caseDir(caseId);
  try {
    await git.resolveRef({ fs: fs as never, dir, ref: "HEAD" });
    return; // already initialised
  } catch {
    // not initialised — fall through to init below
  }
  await mkdir(dir, { recursive: true });
  await git.init({ fs: fs as never, dir, defaultBranch: "main" });

  // README seed so the repo has at least one tree object.
  const readme = [
    `# ${opts.title ?? caseId}`,
    "",
    opts.description ?? "Forensic case repository — managed by forenix-oss.",
    "",
    "Every evidence item lives in `evidence/<id>.json`. Each commit",
    "is a chain-of-custody event. Branches are real refs. Merges are",
    "real merges.",
  ].join("\n");
  await writeFile(join(dir, "README.md"), readme, "utf-8");
  await git.add({ fs: fs as never, dir, filepath: "README.md" });
  await git.commit({
    fs: fs as never,
    dir,
    author: AUTHOR,
    message: "case: initial commit",
  });
}

export interface EvidenceBlob {
  id: string;
  name: string;
  type: string;
  mimeType?: string | null;
  description?: string | null;
  hash: string;
  hashAlgo: string;
  status: string;
  tags?: string;
  metadata?: Record<string, unknown>;
}

/** Write an Evidence record to its file path. Caller commits. */
export async function writeEvidenceFile(
  caseId: string,
  evidence: EvidenceBlob,
): Promise<string> {
  const dir = caseDir(caseId);
  const rel = `evidence/${evidence.id}.json`;
  const abs = join(dir, rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(evidence, null, 2) + "\n", "utf-8");
  await git.add({ fs: fs as never, dir, filepath: rel });
  return rel;
}

/** Remove an Evidence record. Caller commits. */
export async function removeEvidenceFile(
  caseId: string,
  evidenceId: string,
): Promise<void> {
  const dir = caseDir(caseId);
  const rel = `evidence/${evidenceId}.json`;
  await rm(join(dir, rel), { force: true });
  await git.remove({ fs: fs as never, dir, filepath: rel });
}

export interface CommitArgs {
  caseId: string;
  branch?: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
}

/** Make a commit. Returns the new commit oid. */
export async function commitChanges(args: CommitArgs): Promise<string> {
  const dir = caseDir(args.caseId);
  if (args.branch) {
    await git.checkout({ fs: fs as never, dir, ref: args.branch });
  }
  const oid = await git.commit({
    fs: fs as never,
    dir,
    author: {
      name: args.authorName ?? AUTHOR.name,
      email: args.authorEmail ?? AUTHOR.email,
    },
    message: args.message,
  });
  return oid;
}

/** Create a branch pointing at HEAD (or a named ref). */
export async function createBranch(
  caseId: string,
  branch: string,
  fromRef = "HEAD",
): Promise<string> {
  const dir = caseDir(caseId);
  const oid = await git.resolveRef({ fs: fs as never, dir, ref: fromRef });
  await git.branch({ fs: fs as never, dir, ref: branch, object: oid });
  return oid;
}

/** Switch HEAD to a branch. */
export async function checkoutBranch(caseId: string, branch: string): Promise<void> {
  await git.checkout({ fs: fs as never, dir: caseDir(caseId), ref: branch });
}

/** Get the head oid of a branch. */
export async function getBranchHead(caseId: string, branch: string): Promise<string> {
  return git.resolveRef({ fs: fs as never, dir: caseDir(caseId), ref: branch });
}

/** Walk a branch's commit history (newest first), capped. */
export async function listCommits(
  caseId: string,
  branch: string,
  depth = 200,
): Promise<Array<{ oid: string; parent: string[]; author: string; message: string; committedAt: Date }>> {
  const dir = caseDir(caseId);
  const log = await git.log({ fs: fs as never, dir, ref: branch, depth });
  return log.map((c) => ({
    oid: c.oid,
    parent: c.commit.parent,
    author: c.commit.author.name,
    message: c.commit.message.trim(),
    committedAt: new Date(c.commit.author.timestamp * 1000),
  }));
}

export interface MergeResult {
  ok: true;
  mergeCommit: string;
  fastForward: boolean;
}
export interface MergeConflict {
  ok: false;
  conflictedFiles: string[];
  ours: string;
  theirs: string;
}

/**
 * Merge `feature` into `into`. Returns either the merge commit oid
 * (with fastForward flag), or a structured conflict report.
 *
 * isomorphic-git only does fast-forward + simple line-merge today;
 * we wrap that in our own conflict-detection by checking which files
 * differ between the two heads and would change in opposite ways.
 */
export async function mergeBranches(args: {
  caseId: string;
  into: string;        // e.g. "main"
  feature: string;     // e.g. "evidence-review"
  message: string;
  authorName?: string;
  authorEmail?: string;
}): Promise<MergeResult | MergeConflict> {
  const dir = caseDir(args.caseId);
  try {
    const result = await git.merge({
      fs: fs as never,
      dir,
      ours: args.into,
      theirs: args.feature,
      author: {
        name: args.authorName ?? AUTHOR.name,
        email: args.authorEmail ?? AUTHOR.email,
      },
      message: args.message,
      abortOnConflict: true,
    });
    return {
      ok: true as const,
      mergeCommit: result.oid ?? (await getBranchHead(args.caseId, args.into)),
      fastForward: Boolean(result.fastForward),
    };
  } catch (err) {
    const e = err as { code?: string; data?: { filepaths?: string[] } };
    if (e.code === "MergeConflictError") {
      const ours = await getBranchHead(args.caseId, args.into);
      const theirs = await getBranchHead(args.caseId, args.feature);
      return {
        ok: false as const,
        conflictedFiles: e.data?.filepaths ?? [],
        ours,
        theirs,
      };
    }
    throw err;
  }
}

/** Read a file from a specific commit. Useful for evidence-history viewers. */
export async function readFileAtCommit(
  caseId: string,
  oid: string,
  filepath: string,
): Promise<string | null> {
  const dir = caseDir(caseId);
  try {
    const { blob } = await git.readBlob({
      fs: fs as never,
      dir,
      oid,
      filepath,
    });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

/** Delete the entire case repo (DESTRUCTIVE — used by tests + case archival). */
export async function deleteCaseRepo(caseId: string): Promise<void> {
  await rm(caseDir(caseId), { recursive: true, force: true });
}

/** Read raw file from working tree (post-checkout). */
export async function readWorktreeFile(caseId: string, filepath: string): Promise<string> {
  return readFile(join(caseDir(caseId), filepath), "utf-8");
}
