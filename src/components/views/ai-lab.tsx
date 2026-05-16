"use client";

import { Sparkles, Activity, CheckCircle2, AlertCircle, Loader2, RotateCw, X } from "lucide-react";
import { toast } from "sonner";

import { useAgents, useAgentTaskAction } from "@/lib/hooks";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

function StatusIcon({ s }: { s: string }) {
  switch (s) {
    case "completed": return <CheckCircle2 className="h-3 w-3 text-[var(--accent-strong)]" />;
    case "running":   return <Loader2 className="h-3 w-3 animate-spin text-[var(--warn)]" />;
    case "failed":    return <AlertCircle className="h-3 w-3 text-[var(--danger)]" />;
    default:          return <Activity className="h-3 w-3 text-[var(--foreground-muted)]" />;
  }
}

export function AILabView() {
  const a = useAgents();
  const taskAction = useAgentTaskAction();
  const rows = a.data?.data ?? [];

  async function onTaskAction(id: string, action: "cancel" | "rerun") {
    try {
      await taskAction.mutateAsync({ id, action });
      toast.success(action === "cancel" ? "Task cancelled" : "Re-run queued");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <ViewShell
      title="AI Lab"
      subtitle="Agents and the tasks they've executed. Every task carries its raw input, raw output, and a 0–1 confidence."
      actions={<span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} agents</span>}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((agent) => (
          <article key={agent.id} className="glass rounded-lg p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                  {agent.type}
                </div>
                <h3 className="mt-0.5 text-[14px] font-medium text-[var(--foreground)]">{agent.name}</h3>
                {agent.description && (
                  <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">{agent.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--foreground-muted)]">
                  <span>model: <span className="font-mono">{agent.model}</span></span>
                  <span>tasks: {agent._count.tasks}</span>
                  <span>cases: {agent._count.assignments}</span>
                </div>
              </div>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                  agent.status === "idle"
                    ? "bg-[var(--background-elev-2)] text-[var(--foreground-muted)]"
                    : agent.status === "busy"
                    ? "bg-[rgba(245,158,11,0.12)] text-[var(--warn)]"
                    : "bg-[rgba(239,68,68,0.12)] text-[var(--danger)]",
                )}
              >
                {agent.status}
              </span>
            </header>

            {agent.tasks.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  Recent tasks
                </div>
                <ul className="mt-1 space-y-1">
                  {agent.tasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="rounded border border-[var(--border)] bg-[var(--background-elev)] px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <StatusIcon s={t.status} />
                        <span className="capitalize text-[var(--foreground)]">{t.type}</span>
                        <span className="text-[10px] text-[var(--foreground-muted)]">conf {(t.confidence * 100).toFixed(0)}%</span>
                        <span className="ml-auto text-[10px] text-[var(--foreground-muted)]">{relTime(t.createdAt)}</span>
                        {(t.status === "pending" || t.status === "running") && (
                          <button
                            type="button"
                            onClick={() => onTaskAction(t.id, "cancel")}
                            disabled={taskAction.isPending}
                            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[9px] text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {(t.status === "completed" || t.status === "failed") && (
                          <button
                            type="button"
                            onClick={() => onTaskAction(t.id, "rerun")}
                            disabled={taskAction.isPending}
                            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[9px] text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
                            title="Re-run"
                          >
                            <RotateCw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {t.output && (
                        <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-[var(--background-elev-2)] p-2 font-mono text-[10px] text-[var(--foreground-muted)]">
                          {t.output.length > 320 ? t.output.slice(0, 320) + "…" : t.output}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
        {rows.length === 0 && !a.isLoading && (
          <div className="glass col-span-full rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            No agents yet.
          </div>
        )}
      </div>
    </ViewShell>
  );
}
