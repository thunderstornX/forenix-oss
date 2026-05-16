"use client";

import { useQuery } from "@tanstack/react-query";
import { Users as UsersIcon, ShieldCheck } from "lucide-react";

import { relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  membershipRole: string;
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: { id: string; name: string; email: string };
  }>;
  _count: { cases: number; investigations: number };
  createdAt: string;
}

async function http<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function TeamsView() {
  const list = useQuery({
    queryKey: ["my-teams"],
    queryFn: () => http<{ data: TeamRow[] }>("/api/teams"),
  });
  const rows = list.data?.data ?? [];

  return (
    <ViewShell
      title="Teams"
      subtitle="Teams you belong to. Each team owns its own cases and investigations — visibility is scoped to membership."
      actions={<span className="text-[11px] text-[var(--foreground-muted)]">{rows.length} memberships</span>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((t) => (
          <article key={t.id} className="glass rounded-lg p-4">
            <header className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  <UsersIcon className="h-3 w-3 text-[var(--accent)]" />
                  <span className="font-mono">{t.slug}</span>
                </div>
                <h3 className="mt-0.5 text-[14px] font-medium text-[var(--foreground)]">{t.name}</h3>
                {t.description && (
                  <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">{t.description}</p>
                )}
              </div>
              <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium capitalize text-[var(--accent-strong)]">
                you: {t.membershipRole}
              </span>
            </header>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--foreground-muted)]">
              <span>{t._count.cases} cases</span>
              <span>{t._count.investigations} investigations</span>
              <span>{t.members.length} members</span>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Members
              </div>
              <ul className="space-y-1">
                {t.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[11px]">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />
                      <span className="text-[var(--foreground)]">{m.user.name}</span>
                      <span className="font-mono text-[10px] text-[var(--foreground-muted)]">{m.user.email}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                      {m.role} · {relTime(m.joinedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
        {rows.length === 0 && !list.isLoading && (
          <div className="glass col-span-full rounded-lg p-6 text-center text-[12px] text-[var(--foreground-muted)]">
            You don&apos;t belong to any teams yet. Ask an admin for an invite link.
          </div>
        )}
      </div>
    </ViewShell>
  );
}
