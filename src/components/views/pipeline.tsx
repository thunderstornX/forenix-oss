"use client";

import { useState } from "react";
import { Loader2, Play, Telescope, Sparkles, GitMerge, ScrollText, Folders } from "lucide-react";
import { toast } from "sonner";

import {
  useBridgeToCase,
  useInvestigations,
  useRunPipeline,
  type PipelineRunResult,
} from "@/lib/hooks";
import { useUI } from "@/lib/store";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

type StageState = "idle" | "running" | "done" | "error";

interface StageRow {
  key: string;
  label: string;
  state: StageState;
}

const ALL_GROUPS = ["identity", "infrastructure", "financial", "social", "geo", "relationships", "media"] as const;

export function PipelineView() {
  const setActiveInv = useUI((s) => s.setActiveInvestigation);
  const setActiveCase = useUI((s) => s.setActiveCase);
  const setView = useUI((s) => s.setView);

  const list = useInvestigations();
  const items = list.data?.data ?? [];

  const run = useRunPipeline();
  const bridge = useBridgeToCase();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>(["identity", "infrastructure", "social"]);
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [stages, setStages] = useState<StageRow[]>(initialStages(["identity", "infrastructure", "social"]));

  function initialStages(g: string[]): StageRow[] {
    const out: StageRow[] = [];
    for (const grp of g) out.push({ key: `agent_${grp}`, label: `${grp} agent`, state: "idle" });
    out.push({ key: "extract", label: "extract entities", state: "idle" });
    out.push({ key: "report",  label: "generate report",  state: "idle" });
    return out;
  }

  function setStage(key: string, state: StageState) {
    setStages((cur) => cur.map((s) => (s.key === key ? { ...s, state } : s)));
  }

  async function execute() {
    if (!selectedId) return;
    setResult(null);
    const pre = initialStages(groups);
    setStages(pre);

    // Pre-flight: mark agents running sequentially while the server
    // works (we don't have streaming yet — this gives the UI motion).
    for (const grp of groups) setStage(`agent_${grp}`, "running");
    setStage("extract", "idle");
    setStage("report",  "idle");

    try {
      const res = await run.mutateAsync({ id: selectedId, agentGroups: groups });
      for (const grp of groups) setStage(`agent_${grp}`, "done");
      setStage("extract", "done");
      setStage("report",  "done");
      setResult(res.data);
      toast.success(`Pipeline complete · ${res.data.findings} findings · ${res.data.entities} entities`);
    } catch (err) {
      for (const stage of pre) setStage(stage.key, "error");
      toast.error((err as Error).message);
    }
  }

  async function openCase() {
    if (!selectedId) return;
    try {
      const res = await bridge.mutateAsync({ id: selectedId, promoteFindings: true });
      if (res.data.alreadyLinked) {
        toast.info("Investigation already linked to a case");
      } else {
        toast.success(`Case ${res.data.case.caseNumber} opened · ${res.data.promoted} promoted to evidence`);
      }
      setActiveCase(res.data.case.id);
      setView("cases");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <ViewShell
      title="Pipeline"
      subtitle="Run the OSINT pipeline against an investigation; when it finishes, promote it into a forensic case in one click."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Left: configure + run ── */}
        <section className="glass rounded-lg p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">Configure run</h3>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Investigation</span>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
            >
              <option value="">— pick one —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Agent groups</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_GROUPS.map((g) => {
                const active = groups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))
                    }
                    className={cn(
                      "rounded border px-2 py-0.5 text-[11px] capitalize transition-colors",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-[var(--border)] bg-[var(--background-elev)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={execute}
            disabled={!selectedId || groups.length === 0 || run.isPending}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] py-2 text-[12px] font-medium text-[var(--accent-strong)] forensic-glow disabled:opacity-50"
          >
            {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {run.isPending ? "Running pipeline…" : "Run pipeline"}
          </button>
        </section>

        {/* ── Right: stage progress ── */}
        <section className="glass rounded-lg p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">Stages</h3>
          <ol className="space-y-1.5">
            {stages.map((s) => (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-3 rounded border px-3 py-2 text-[12px] transition-colors",
                  s.state === "done"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : s.state === "running"
                    ? "border-[var(--warn)] bg-[rgba(245,158,11,0.08)] text-[var(--foreground)]"
                    : s.state === "error"
                    ? "border-[var(--danger)] bg-[rgba(239,68,68,0.08)] text-[var(--danger)]"
                    : "border-[var(--border)] bg-[var(--background-elev)] text-[var(--foreground-muted)]",
                )}
              >
                <StageIcon state={s.state} />
                <span className="capitalize">{s.label}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Result + bridge */}
      {result && (
        <section className="glass-strong rounded-lg p-4 forensic-glow">
          <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">Pipeline complete</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat icon={<Sparkles className="h-4 w-4 text-[var(--accent)]" />}    label="adapter"  value={result.adapter} />
            <ResultStat icon={<Telescope className="h-4 w-4 text-[var(--accent)]" />}   label="findings" value={result.findings} />
            <ResultStat icon={<GitMerge className="h-4 w-4 text-[var(--accent)]" />}    label="entities" value={result.entities} />
            <ResultStat icon={<ScrollText className="h-4 w-4 text-[var(--accent)]" />} label="relations" value={result.relations} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveInv(result.investigationId); setView("investigations"); }}
              className="rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1.5 text-[12px] text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              View investigation
            </button>
            <button
              type="button"
              onClick={openCase}
              disabled={bridge.isPending}
              className="flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--forensic)] forensic-glow disabled:opacity-60"
            >
              {bridge.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Folders className="h-3.5 w-3.5" />}
              Open forensic case →
            </button>
          </div>
        </section>
      )}

      {/* Recent investigations table to make picking faster */}
      <section className="glass rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Recent investigations</h3>
        <ul className="space-y-1">
          {items.slice(0, 5).map((i) => (
            <li
              key={i.id}
              onClick={() => setSelectedId(i.id)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded border px-3 py-2 text-[12px]",
                selectedId === i.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--background-elev)] hover:border-[var(--accent)]",
              )}
            >
              <span className="min-w-0 truncate">
                <span className="text-[var(--foreground)]">{i.title}</span>{" "}
                <span className="font-mono text-[10px] text-[var(--foreground-muted)]">{i.target}</span>
              </span>
              <span className="shrink-0 text-[10px] text-[var(--foreground-muted)]">{relTime(i.updatedAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </ViewShell>
  );
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (state === "done")    return <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />;
  if (state === "error")   return <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />;
  return <span className="h-2 w-2 rounded-full bg-[var(--background-elev-2)]" />;
}

function ResultStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}
