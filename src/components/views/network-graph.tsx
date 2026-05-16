"use client";

import { useMemo, useRef } from "react";
import { Network } from "lucide-react";

import { useNetwork, type NetworkNode } from "@/lib/hooks";

import { ViewShell } from "./view-shell";

interface Positioned extends NetworkNode {
  x: number;
  y: number;
}

const KIND_COLOR: Record<NetworkNode["kind"], string> = {
  user:          "#14b8a6",
  agent:         "#a855f7",
  investigation: "#0ea5e9",
  case:          "#34d399",
  evidence:      "#f59e0b",
  entity:        "#f472b6",
};
const KIND_RADIUS: Record<NetworkNode["kind"], number> = {
  user: 7, agent: 7, investigation: 9, case: 11, evidence: 6, entity: 5,
};

/**
 * Lightweight force-free layout — group by kind, place each group on
 * a horizontal swimlane. Within each lane, evenly-spaced. Stable and
 * cheap, no physics, no animation thrash, no extra dependencies.
 */
function layout(nodes: NetworkNode[], width: number, height: number): Positioned[] {
  const kinds = ["case", "investigation", "evidence", "user", "agent", "entity"] as const;
  const lanePad = 60;
  const usable = height - lanePad * 2;
  const laneHeight = usable / kinds.length;

  const byKind = new Map<NetworkNode["kind"], NetworkNode[]>();
  for (const k of kinds) byKind.set(k, []);
  for (const n of nodes) byKind.get(n.kind)?.push(n);

  const out: Positioned[] = [];
  kinds.forEach((k, ki) => {
    const list = byKind.get(k) ?? [];
    if (list.length === 0) return;
    const laneY = lanePad + laneHeight * (ki + 0.5);
    const stepX = (width - 80) / Math.max(list.length, 1);
    list.forEach((n, i) => {
      const x = 40 + stepX * (i + 0.5);
      out.push({ ...n, x, y: laneY });
    });
  });
  return out;
}

export function NetworkGraphView() {
  const net = useNetwork();
  const data = net.data?.data;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const W = 920;
  const H = 560;
  const positioned = useMemo(
    () => layout(data?.nodes ?? [], W, H),
    [data?.nodes],
  );
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  return (
    <ViewShell
      title="Network Graph"
      subtitle="Cross-case knowledge graph — analysts, agents, investigations, cases, evidence, and the discovered entity graph, all on one canvas."
      actions={
        <span className="text-[11px] text-[var(--foreground-muted)]">
          {data?.nodes.length ?? 0} nodes · {data?.edges.length ?? 0} edges
        </span>
      }
    >
      {/* Legend */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg p-3 text-[11px]">
        {(Object.entries(KIND_COLOR) as [NetworkNode["kind"], string][]).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />
            <span className="capitalize">{k}</span>
          </span>
        ))}
      </div>

      <div ref={containerRef} className="glass overflow-auto rounded-lg p-4">
        {positioned.length === 0 ? (
          <div className="grid place-items-center py-16 text-center text-[12px] text-[var(--foreground-muted)]">
            <Network className="mb-2 h-5 w-5" />
            No graph data yet — run a pipeline and bridge to a case to populate it.
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="rgba(255,255,255,0.35)" />
              </marker>
            </defs>
            {/* Edges */}
            {(data?.edges ?? []).map((e, i) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              return (
                <g key={i}>
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={1.2}
                    markerEnd="url(#arrow)"
                  />
                </g>
              );
            })}
            {/* Nodes */}
            {positioned.map((n) => (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                <circle
                  r={KIND_RADIUS[n.kind]}
                  fill={KIND_COLOR[n.kind]}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={1}
                />
                <title>{`${n.kind}: ${n.label}`}</title>
                <text
                  y={KIND_RADIUS[n.kind] + 11}
                  fill="rgba(233,236,242,0.85)"
                  fontSize={9}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </ViewShell>
  );
}
