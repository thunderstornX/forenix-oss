"use client";

import { GitBranch, GitCommit, GitMerge, Folders } from "lucide-react";

import { useCase, useCases } from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime, shortHash } from "@/lib/utils";

import { ViewShell } from "./view-shell";

interface GraphNode {
  commitHash: string;
  parentHash: string | null;
  message: string;
  branch: { name: string; color: string };
  evidenceName: string;
  changeType: string;
  verified: boolean;
  createdAt: string;
  lane: number; // x-position of the dot
}

function buildLaneAssignment(branches: { id: string; name: string; color: string; isMain: boolean }[]) {
  // main on the leftmost lane, then in order of creation.
  const sorted = [...branches].sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const lanes: Record<string, number> = {};
  sorted.forEach((b, i) => { lanes[b.name] = i; });
  return lanes;
}

export function BranchGraphView() {
  const activeCaseId = useUI((s) => s.activeCaseId);
  const setActiveCase = useUI((s) => s.setActiveCase);
  const list = useCases();
  const cases = list.data?.data ?? [];

  if (!activeCaseId) {
    return (
      <ViewShell
        title="Branch graph"
        subtitle="Pick a case to render its git-style evidence-commit graph."
      >
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActiveCase(c.id)}
                className="flex w-full items-center justify-between rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2 text-left hover:border-[var(--forensic)]"
              >
                <span className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
                  <Folders className="h-3.5 w-3.5 text-[var(--forensic)]" />
                  {c.title}
                </span>
                <span className="font-mono text-[11px] text-[var(--foreground-muted)]">{c.caseNumber}</span>
              </button>
            </li>
          ))}
        </ul>
      </ViewShell>
    );
  }

  return <BranchGraphForCase caseId={activeCaseId} />;
}

function BranchGraphForCase({ caseId }: { caseId: string }) {
  const detail = useCase(caseId);
  const setActiveCase = useUI((s) => s.setActiveCase);
  const c = detail.data?.data;

  if (detail.isLoading) {
    return (
      <ViewShell title="Branch graph">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--foreground-muted)]">Loading...</div>
      </ViewShell>
    );
  }
  if (!c) {
    return (
      <ViewShell title="Branch graph">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--danger)]">Case not found.</div>
      </ViewShell>
    );
  }

  const lanes = buildLaneAssignment(c.branches);
  const nodes: GraphNode[] = [];
  for (const ev of c.evidence) {
    for (const commit of ev.commits) {
      nodes.push({
        commitHash: commit.commitHash,
        parentHash: commit.parentHash,
        message: commit.message,
        branch: commit.branch,
        evidenceName: ev.name,
        changeType: commit.changeType,
        verified: commit.verified,
        createdAt: commit.createdAt,
        lane: lanes[commit.branch.name] ?? 0,
      });
    }
  }
  // Sort by createdAt asc, so commits read top->bottom chronologically.
  nodes.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  const laneCount = Object.keys(lanes).length || 1;
  const laneWidth = 28;
  const rowHeight = 44;
  const width = laneCount * laneWidth + 24;
  const height = nodes.length * rowHeight + 16;

  return (
    <ViewShell
      title={`Branch graph  -  ${c.caseNumber}`}
      subtitle={c.title}
      actions={
        <button
          type="button"
          onClick={() => setActiveCase(null)}
          className="rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          Pick another case
        </button>
      }
    >
      {/* Branch legend */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg p-3">
        {c.branches.map((b) => (
          <div key={b.id} className="flex items-center gap-1.5 text-[11px] text-[var(--foreground)]">
            <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
            <GitBranch className="h-3 w-3 text-[var(--foreground-muted)]" />
            <span>{b.name}</span>
            {b.isMain && (
              <span className="rounded bg-[var(--accent-soft)] px-1 py-0.5 text-[9px] text-[var(--accent-strong)]">main</span>
            )}
            <span className="text-[10px] text-[var(--foreground-muted)]">{b._count.commits} commits</span>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="glass rounded-lg p-4">
        <div className="flex">
          <svg width={width} height={height} className="shrink-0">
            {/* Vertical lane lines */}
            {Array.from({ length: laneCount }).map((_, i) => (
              <line
                key={i}
                x1={12 + i * laneWidth}
                y1={8}
                x2={12 + i * laneWidth}
                y2={height - 8}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            ))}
            {/* Edges from parent to child if same lane */}
            {nodes.map((n, idx) => {
              if (idx === 0) return null;
              const prev = nodes[idx - 1]!;
              const x1 = 12 + prev.lane * laneWidth;
              const y1 = 8 + idx * rowHeight - rowHeight + rowHeight / 2;
              const x2 = 12 + n.lane * laneWidth;
              const y2 = 8 + idx * rowHeight + rowHeight / 2 - 4;
              return (
                <line
                  key={"edge_" + idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={n.branch.color}
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                />
              );
            })}
            {/* Commit dots */}
            {nodes.map((n, idx) => (
              <circle
                key={n.commitHash}
                cx={12 + n.lane * laneWidth}
                cy={8 + idx * rowHeight + rowHeight / 2 - 4}
                r={5}
                fill={n.branch.color}
                stroke={n.verified ? "#34d399" : "rgba(255,255,255,0.2)"}
                strokeWidth={n.verified ? 2 : 1}
              />
            ))}
          </svg>

          {/* Commit rows */}
          <div className="flex-1">
            {nodes.map((n, idx) => (
              <div
                key={n.commitHash}
                className="flex items-center gap-3 px-2 py-1.5 text-[12px]"
                style={{ minHeight: rowHeight - 4 }}
              >
                <span className="font-mono text-[10px] text-[var(--foreground-muted)]">
                  {shortHash(n.commitHash)}
                </span>
                <span className="rounded bg-[var(--background-elev-2)] px-1 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  {n.changeType}
                </span>
                <span className="flex-1 truncate text-[var(--foreground)]">{n.message}</span>
                <span className="font-mono text-[10px] text-[var(--foreground-muted)]">{n.evidenceName}</span>
                <span className={cn("text-[10px]", n.verified ? "text-[var(--accent-strong)]" : "text-[var(--foreground-muted)]")}>
                  {n.verified ? "verified" : "unverified"}
                </span>
                <span className="text-[10px] text-[var(--foreground-muted)]">{relTime(n.createdAt)}</span>
                {idx === 0 && (
                  <GitCommit className="h-3 w-3 text-[var(--accent)]" aria-label="root commit" />
                )}
                {n.changeType === "merge" && (
                  <GitMerge className="h-3 w-3 text-[var(--forensic)]" />
                )}
              </div>
            ))}
            {nodes.length === 0 && (
              <div className="rounded border border-dashed border-[var(--border)] p-4 text-center text-[12px] text-[var(--foreground-muted)]">
                No commits yet for this case.
              </div>
            )}
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
