"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Lock, Sparkles, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { ViewShell } from "./view-shell";

interface AdapterRow {
  name: string;
  cost: string;
  envKey: string | null;
  model: string | null;
  modelValue: string | null;
  keyPresent: boolean;
  saasOnly: boolean;
  active: boolean;
}

interface SettingsPayload {
  activeAdapter: string;
  saasMode: boolean;
  version: string;
  adapters: AdapterRow[];
}

async function http<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function SettingsView() {
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => http<{ data: SettingsPayload }>("/api/settings"),
  });

  if (q.isLoading) {
    return (
      <ViewShell title="Settings">
        <div className="glass rounded-lg p-6 text-[12px] text-[var(--foreground-muted)]">
          <Loader2 className="mb-2 h-4 w-4 animate-spin" />
          Loading...
        </div>
      </ViewShell>
    );
  }
  const s = q.data?.data;
  if (!s) return null;

  return (
    <ViewShell
      title="Settings"
      subtitle="Read-only view of the deployment configuration. To change the active adapter, edit the AI_ADAPTER env var and restart, or pass `adapter:` in a pipeline POST body."
      actions={
        <span className="flex items-center gap-2 text-[11px] text-[var(--foreground-muted)]">
          version <span className="font-mono text-[var(--foreground)]">{s.version}</span>
          {" | "}
          SAAS_MODE {s.saasMode ? <CheckCircle2 className="h-3 w-3 text-[var(--accent)]" /> : <span className="text-[var(--foreground-muted)]">false</span>}
        </span>
      }
    >
      <section className="glass rounded-lg p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--foreground)]">AI adapters</h3>
        <table className="w-full text-[12px]">
          <thead className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-2 py-1.5 font-medium">Adapter</th>
              <th className="px-2 py-1.5 font-medium">Cost</th>
              <th className="px-2 py-1.5 font-medium">Key</th>
              <th className="px-2 py-1.5 font-medium">Model</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {s.adapters.map((a) => (
              <tr key={a.name} className={cn(
                "border-b border-[var(--border)] last:border-0",
                a.active && "bg-[var(--accent-soft)]",
              )}>
                <td className="px-2 py-1.5 font-mono">{a.name}</td>
                <td className="px-2 py-1.5 text-[var(--foreground-muted)]">{a.cost}</td>
                <td className="px-2 py-1.5">
                  {a.envKey ? (
                    <span className="flex items-center gap-1.5 text-[10px]">
                      <span className="font-mono">{a.envKey}</span>
                      {a.keyPresent
                        ? <CheckCircle2 className="h-3 w-3 text-[var(--accent-strong)]" />
                        : <AlertCircle className="h-3 w-3 text-[var(--warn)]" />}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--foreground-muted)]">(none required)</span>
                  )}
                </td>
                <td className="px-2 py-1.5 font-mono text-[11px] text-[var(--foreground-muted)]">
                  {a.modelValue ?? " - "}
                </td>
                <td className="px-2 py-1.5">
                  {a.active ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--accent-strong)]">
                      <Sparkles className="h-3 w-3" /> ACTIVE
                    </span>
                  ) : a.saasOnly ? (
                    <span
                      className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-muted)]"
                      title="Part of the private SaaS overlay that powers demo.forenix.tech. Not included in OSS Core."
                    >
                      <Lock className="h-3 w-3" /> overlay only
                    </span>
                  ) : !a.keyPresent ? (
                    <span className="text-[10px] text-[var(--foreground-muted)]">no key</span>
                  ) : (
                    <span className="text-[10px] text-[var(--foreground-muted)]">ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass rounded-lg p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">How to switch</h3>
        <div className="space-y-2 text-[12px] text-[var(--foreground-muted)]">
          <p>
            <span className="font-medium text-[var(--foreground)]">Permanent</span>{" "}
             -  edit <code className="font-mono">.env</code>, set{" "}
            <code className="font-mono">AI_ADAPTER=&lt;name&gt;</code>, and restart the dev server.
          </p>
          <p>
            <span className="font-medium text-[var(--foreground)]">Per-call</span>{" "}
             -  pass <code className="font-mono">adapter</code> in a pipeline POST body:
          </p>
          <pre className="overflow-x-auto rounded bg-[var(--background-elev-2)] p-3 font-mono text-[11px] text-[var(--foreground)]">
{`curl -X POST -H "content-type: application/json" \\
  -d '{"agentGroups":["identity"],"adapter":"groq"}' \\
  /api/pipeline/run/<INVESTIGATION_ID>`}
          </pre>
          <p>
            The factory will <b>never</b> fall through to a paid adapter on a
            bad value  -  it falls back to <code className="font-mono">mock</code>.
          </p>
        </div>
      </section>
    </ViewShell>
  );
}
