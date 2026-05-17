"use client";

import { useMemo } from "react";
import { Network } from "lucide-react";

import { useEntities } from "@/lib/hooks";

import { ViewShell } from "./view-shell";

interface PositionedNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

/**
 * Cheap radial layout  -  group entities by type, place each type on
 * its own ring. Deterministic, no physics, no extra deps.
 */
function layout(entities: { id: string; name: string; type: string }[]): PositionedNode[] {
  const byType = new Map<string, typeof entities>();
  for (const e of entities) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e);
  }
  const W = 720, H = 480, cx = W / 2, cy = H / 2;
  const types = [...byType.keys()];
  const out: PositionedNode[] = [];
  types.forEach((t, ti) => {
    const arr = byType.get(t)!;
    const radius = 70 + ti * 70;
    arr.forEach((e, i) => {
      const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
      out.push({
        id: e.id,
        name: e.name,
        type: e.type,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  });
  return out;
}

const TYPE_COLOR: Record<string, string> = {
  person: "#14b8a6",
  organization: "#34d399",
  domain: "#7c3aed",
  ip: "#f59e0b",
  email: "#0ea5e9",
  phone: "#f472b6",
  account: "#a855f7",
  location: "#22c55e",
};

export function EntityGraphView() {
  const ent = useEntities();
  const data = ent.data?.data;

  const positioned = useMemo(() => layout(data?.entities ?? []), [data?.entities]);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  return (
    <ViewShell
      title="Entity graph"
      subtitle="Entities discovered across investigations + their relations. Type-grouped radial layout."
      actions={
        <span className="text-[11px] text-[var(--foreground-muted)]">
          {data?.entities.length ?? 0} entities | {data?.relations.length ?? 0} relations
        </span>
      }
    >
      {/* Legend */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg p-3 text-[11px]">
        {Object.entries(TYPE_COLOR).map(([t, c]) => (
          <span key={t} className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />
            {t}
          </span>
        ))}
      </div>

      <div className="glass rounded-lg p-4">
        {positioned.length === 0 ? (
          <div className="grid place-items-center py-12 text-center text-[12px] text-[var(--foreground-muted)]">
            <Network className="mb-2 h-5 w-5" />
            No entities yet. Run the pipeline to populate the graph.
          </div>
        ) : (
          <svg viewBox="0 0 720 480" className="h-[480px] w-full">
            {/* Relations */}
            {(data?.relations ?? []).map((r) => {
              const a = byId.get(r.from);
              const b = byId.get(r.to);
              if (!a || !b) return null;
              const opacity =
                r.confidence === "confirmed" ? 0.7 :
                r.confidence === "probable"  ? 0.4 : 0.2;
              return (
                <g key={r.id}>
                  <line
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#14b8a6"
                    strokeOpacity={opacity}
                    strokeWidth={1.5}
                  />
                  <text
                    x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                    fill="rgba(255,255,255,0.5)"
                    fontSize={9}
                    textAnchor="middle"
                  >
                    {r.relationType}
                  </text>
                </g>
              );
            })}
            {/* Nodes */}
            {positioned.map((n) => (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                <circle r={9} fill={TYPE_COLOR[n.type] ?? "#9aa3b2"} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                <text
                  y={22}
                  fill="rgba(233,236,242,0.9)"
                  fontSize={10}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {n.name.length > 22 ? n.name.slice(0, 20) + "..." : n.name}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </ViewShell>
  );
}
