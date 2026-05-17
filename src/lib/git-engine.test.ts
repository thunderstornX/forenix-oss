/**
 * git-engine tests  -  real Git semantics on top of isomorphic-git.
 *
 * Each test uses a fresh case repo under a temp dir so they don't
 * interfere with each other or the developer's real case-repos.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  ensureCaseRepo,
  writeEvidenceFile,
  commitChanges,
  createBranch,
  checkoutBranch,
  getBranchHead,
  listCommits,
  mergeBranches,
  readFileAtCommit,
  deleteCaseRepo,
} from "./git-engine";

let TMP_ROOT: string;

beforeAll(async () => {
  TMP_ROOT = await mkdtemp(join(tmpdir(), "forenix-git-engine-"));
  process.env.CASE_REPO_ROOT = TMP_ROOT;
});

afterAll(async () => {
  if (TMP_ROOT) {
    await rm(TMP_ROOT, { recursive: true, force: true });
  }
});

describe("git-engine", () => {
  it("initialises a fresh case repo with a README + initial commit", async () => {
    const caseId = "case-init-" + Date.now();
    await ensureCaseRepo(caseId, { title: "Test Case", description: "desc" });
    const head = await getBranchHead(caseId, "main");
    expect(head).toMatch(/^[0-9a-f]{40}$/);
    const log = await listCommits(caseId, "main");
    expect(log).toHaveLength(1);
    expect(log[0]!.message).toBe("case: initial commit");
    await deleteCaseRepo(caseId);
  });

  it("ensureCaseRepo is idempotent", async () => {
    const caseId = "case-idempotent-" + Date.now();
    await ensureCaseRepo(caseId);
    const first = await getBranchHead(caseId, "main");
    await ensureCaseRepo(caseId); // second call should be a no-op
    const second = await getBranchHead(caseId, "main");
    expect(first).toBe(second);
    await deleteCaseRepo(caseId);
  });

  it("commits an Evidence record and gives back a real oid", async () => {
    const caseId = "case-commit-" + Date.now();
    await ensureCaseRepo(caseId);

    await writeEvidenceFile(caseId, {
      id: "ev1",
      name: "smtp-headers.eml",
      type: "document",
      hash: "0".repeat(64),
      hashAlgo: "SHA-256",
      status: "collected",
    });
    const oid = await commitChanges({
      caseId,
      message: "add: smtp-headers.eml",
    });
    expect(oid).toMatch(/^[0-9a-f]{40}$/);

    // The commit should now appear in the log.
    const log = await listCommits(caseId, "main");
    expect(log).toHaveLength(2);
    expect(log[0]!.message).toBe("add: smtp-headers.eml");

    // The file content at that oid should match what we wrote.
    const content = await readFileAtCommit(caseId, oid, "evidence/ev1.json");
    expect(content).toContain('"name": "smtp-headers.eml"');

    await deleteCaseRepo(caseId);
  });

  it("creates a branch and divergent commits coexist", async () => {
    const caseId = "case-branch-" + Date.now();
    await ensureCaseRepo(caseId);

    // main: ev1
    await writeEvidenceFile(caseId, {
      id: "ev1", name: "ev1.json", type: "document",
      hash: "1".repeat(64), hashAlgo: "SHA-256", status: "collected",
    });
    await commitChanges({ caseId, message: "add: ev1" });

    // branch off
    await createBranch(caseId, "review");
    await checkoutBranch(caseId, "review");

    // review: ev2
    await writeEvidenceFile(caseId, {
      id: "ev2", name: "ev2.json", type: "document",
      hash: "2".repeat(64), hashAlgo: "SHA-256", status: "collected",
    });
    const reviewOid = await commitChanges({ caseId, message: "add: ev2 on review" });

    // back to main: ev3 (divergent)
    await checkoutBranch(caseId, "main");
    await writeEvidenceFile(caseId, {
      id: "ev3", name: "ev3.json", type: "document",
      hash: "3".repeat(64), hashAlgo: "SHA-256", status: "collected",
    });
    const mainOid = await commitChanges({ caseId, message: "add: ev3 on main" });

    expect(reviewOid).not.toBe(mainOid);

    const mainLog = await listCommits(caseId, "main");
    const reviewLog = await listCommits(caseId, "review");
    expect(mainLog.map((c) => c.message)).toEqual([
      "add: ev3 on main",
      "add: ev1",
      "case: initial commit",
    ]);
    expect(reviewLog.map((c) => c.message)).toEqual([
      "add: ev2 on review",
      "add: ev1",
      "case: initial commit",
    ]);

    await deleteCaseRepo(caseId);
  });

  it("fast-forward merges a branch with no divergence", async () => {
    const caseId = "case-ff-" + Date.now();
    await ensureCaseRepo(caseId);

    // main: ev1
    await writeEvidenceFile(caseId, {
      id: "ev1", name: "ev1.json", type: "document",
      hash: "1".repeat(64), hashAlgo: "SHA-256", status: "collected",
    });
    await commitChanges({ caseId, message: "add: ev1" });

    // branch with no divergent main commit
    await createBranch(caseId, "ff");
    await checkoutBranch(caseId, "ff");
    await writeEvidenceFile(caseId, {
      id: "ev2", name: "ev2.json", type: "document",
      hash: "2".repeat(64), hashAlgo: "SHA-256", status: "collected",
    });
    await commitChanges({ caseId, message: "add: ev2 on ff" });

    const result = await mergeBranches({
      caseId,
      into: "main",
      feature: "ff",
      message: "merge: ff into main",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fastForward).toBe(true);
      expect(result.mergeCommit).toMatch(/^[0-9a-f]{40}$/);
    }

    await deleteCaseRepo(caseId);
  });

  it("detects merge conflicts and returns the conflicted files", async () => {
    const caseId = "case-conflict-" + Date.now();
    await ensureCaseRepo(caseId);

    // main: ev1 v1
    await writeEvidenceFile(caseId, {
      id: "ev1", name: "ev1.json", type: "document",
      hash: "a".repeat(64), hashAlgo: "SHA-256", status: "collected",
      description: "version-A",
    });
    await commitChanges({ caseId, message: "add: ev1 v1" });

    // branch off
    await createBranch(caseId, "alt");
    await checkoutBranch(caseId, "alt");
    await writeEvidenceFile(caseId, {
      id: "ev1", name: "ev1.json", type: "document",
      hash: "b".repeat(64), hashAlgo: "SHA-256", status: "collected",
      description: "from-the-alt-branch-totally-different",
    });
    await commitChanges({ caseId, message: "update: ev1 on alt" });

    // mutate main in an incompatible way
    await checkoutBranch(caseId, "main");
    await writeEvidenceFile(caseId, {
      id: "ev1", name: "ev1.json", type: "document",
      hash: "c".repeat(64), hashAlgo: "SHA-256", status: "verified",
      description: "from-the-main-branch-also-different",
    });
    await commitChanges({ caseId, message: "update: ev1 on main" });

    const result = await mergeBranches({
      caseId,
      into: "main",
      feature: "alt",
      message: "merge: alt into main",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflictedFiles.length).toBeGreaterThan(0);
      expect(result.conflictedFiles).toContain("evidence/ev1.json");
    }

    await deleteCaseRepo(caseId);
  });
});
