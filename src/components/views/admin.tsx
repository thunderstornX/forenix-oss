"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Key, Loader2, Plus, ShieldAlert, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { useIntegrity, useMe } from "@/lib/hooks";
import { cn, relTime } from "@/lib/utils";

import { ViewShell } from "./view-shell";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "investigator" | "analyst" | "viewer";
  status: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { teamMemberships: number; auditLogs: number };
}

interface AdminTeam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count: { members: number; cases: number; investigations: number };
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? ": " + body : ""}`);
  }
  return res.json() as Promise<T>;
}

export function AdminView() {
  const me = useMe();
  const role = me.data?.data?.role;
  if (role && role !== "admin") {
    return (
      <ViewShell title="Admin" subtitle="Manage users, teams, and system health.">
        <div className="glass flex items-center gap-3 rounded-lg p-6 text-[var(--danger)]">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-[13px]">This view is restricted to users with the <code>admin</code> role.</span>
        </div>
      </ViewShell>
    );
  }
  return <AdminConsole />;
}

function AdminConsole() {
  const integ = useIntegrity();

  return (
    <ViewShell
      title="Admin"
      subtitle="Users, teams, invites, and platform health."
      actions={
        <span className="text-[11px] text-[var(--foreground-muted)]">
          chain: {integ.data?.data && integ.data.data.ok
            ? `green | ${integ.data.data.entries} rows`
            : integ.data?.data
            ? "BROKEN"
            : "checking..."}
        </span>
      }
    >
      <UsersPanel />
      <TeamsPanel />
      <InvitesPanel />
      <VaultPanel />
      <WaitlistPanel />
    </ViewShell>
  );
}

// ───────────────────────── Users ─────────────────────────────────

function UsersPanel() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => http<{ data: AdminUser[] }>("/api/admin/users"),
  });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("investigator");
  const [password, setPassword] = useState("");

  const create = useMutation({
    mutationFn: (body: { email: string; name: string; role: string; password: string }) =>
      http<{ data: AdminUser }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const patch = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: string; disabled?: boolean }) =>
      http<{ data: AdminUser }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ email, name, role, password });
      toast.success("User created");
      setOpen(false); setEmail(""); setName(""); setPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="glass rounded-lg p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          Users <span className="text-[11px] text-[var(--foreground-muted)]">({list.data?.data?.length ?? 0})</span>
        </h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]"
        >
          <Plus className="h-3 w-3" /> Add user
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="mb-3 grid grid-cols-1 gap-2 rounded border border-[var(--border)] bg-[var(--background-elev)] p-3 sm:grid-cols-4">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Name"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" type="email"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password (min 6)" type="password"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          <div className="flex gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}
              className="flex-1 rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]">
              {["admin", "investigator", "analyst", "viewer"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button type="submit" disabled={create.isPending}
              className="flex items-center gap-1 rounded bg-[var(--accent-soft)] px-3 text-[12px] font-medium text-[var(--accent-strong)] disabled:opacity-60">
              {create.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Create
            </button>
          </div>
        </form>
      )}

      <table className="w-full text-[12px]">
        <thead className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
          <tr>
            <th className="px-2 py-1.5 font-medium">Name</th>
            <th className="px-2 py-1.5 font-medium">Email</th>
            <th className="px-2 py-1.5 font-medium">Role</th>
            <th className="px-2 py-1.5 font-medium">Teams</th>
            <th className="px-2 py-1.5 font-medium">Audit</th>
            <th className="px-2 py-1.5 font-medium">Created</th>
            <th className="px-2 py-1.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.data?.map((u) => (
            <tr key={u.id} className={cn(
              "border-b border-[var(--border)] last:border-0",
              u.disabled && "opacity-50",
            )}>
              <td className="px-2 py-1.5">{u.name}</td>
              <td className="px-2 py-1.5 font-mono text-[11px] text-[var(--foreground-muted)]">{u.email}</td>
              <td className="px-2 py-1.5">
                <select
                  value={u.role}
                  onChange={(e) => patch.mutate({ id: u.id, role: e.target.value })}
                  className="rounded border border-[var(--border)] bg-[var(--background-elev)] px-1.5 py-0.5 text-[11px]"
                >
                  {["admin", "investigator", "analyst", "viewer"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1.5">{u._count.teamMemberships}</td>
              <td className="px-2 py-1.5">{u._count.auditLogs}</td>
              <td className="px-2 py-1.5 text-[10px] text-[var(--foreground-muted)]">{relTime(u.createdAt)}</td>
              <td className="px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => patch.mutate({ id: u.id, disabled: !u.disabled })}
                  className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  {u.disabled ? "enable" : "disable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ───────────────────────── Teams ─────────────────────────────────

function TeamsPanel() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => http<{ data: AdminTeam[] }>("/api/admin/teams"),
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: (body: { name: string; slug: string; description?: string }) =>
      http<{ data: AdminTeam }>("/api/admin/teams", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-teams"] }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ name, slug, description: description || undefined });
      toast.success("Team created");
      setOpen(false); setName(""); setSlug(""); setDescription("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="glass rounded-lg p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          Teams <span className="text-[11px] text-[var(--foreground-muted)]">({list.data?.data?.length ?? 0})</span>
        </h3>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
          <Plus className="h-3 w-3" /> Add team
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="mb-3 grid grid-cols-1 gap-2 rounded border border-[var(--border)] bg-[var(--background-elev)] p-3 sm:grid-cols-4">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Display name"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="slug (a-z0-9-)" pattern="[a-z0-9-]+"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 font-mono text-[11px]" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)"
            className="sm:col-span-1 rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          <button type="submit" disabled={create.isPending}
            className="flex items-center justify-center gap-1 rounded bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent-strong)] disabled:opacity-60">
            {create.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Create
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {list.data?.data?.map((t) => (
          <article key={t.id} className="rounded border border-[var(--border)] bg-[var(--background-elev)] p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              <UsersIcon className="h-3 w-3 text-[var(--accent)]" /> <span className="font-mono">{t.slug}</span>
            </div>
            <div className="mt-0.5 text-[13px] text-[var(--foreground)]">{t.name}</div>
            {t.description && <div className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">{t.description}</div>}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--foreground-muted)]">
              <span>{t._count.members} members</span>
              <span>{t._count.cases} cases</span>
              <span>{t._count.investigations} investigations</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── Invites ─────────────────────────────────

interface AdminInvite {
  id: string; email: string; role: string; token: string;
  team: { name: string; slug: string };
  sentBy: { name: string; email: string };
  expiresAt: string; acceptedAt: string | null; createdAt: string;
}

function InvitesPanel() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => http<{ data: AdminInvite[] }>("/api/admin/invites"),
  });
  const teams = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => http<{ data: AdminTeam[] }>("/api/admin/teams"),
  });

  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const create = useMutation({
    mutationFn: (body: { teamId: string; email: string; role: string }) =>
      http<{ data: AdminInvite }>("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-invites"] }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await create.mutateAsync({ teamId, email, role });
      const url = `${window.location.origin}/accept-invite?token=${res.data.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite link copied to clipboard");
      setOpen(false); setEmail("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="glass rounded-lg p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          Invites <span className="text-[11px] text-[var(--foreground-muted)]">({list.data?.data?.length ?? 0})</span>
        </h3>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
          <Plus className="h-3 w-3" /> Invite
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="mb-3 grid grid-cols-1 gap-2 rounded border border-[var(--border)] bg-[var(--background-elev)] p-3 sm:grid-cols-4">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} required
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]">
            <option value=""> -  team  - </option>
            {teams.data?.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" type="email"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]">
            {["member", "admin", "owner", "viewer"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" disabled={create.isPending}
            className="flex items-center justify-center gap-1 rounded bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent-strong)] disabled:opacity-60">
            {create.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Generate link
          </button>
        </form>
      )}

      <table className="w-full text-[12px]">
        <thead className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
          <tr>
            <th className="px-2 py-1.5 font-medium">Email</th>
            <th className="px-2 py-1.5 font-medium">Team</th>
            <th className="px-2 py-1.5 font-medium">Role</th>
            <th className="px-2 py-1.5 font-medium">Status</th>
            <th className="px-2 py-1.5 font-medium">Expires</th>
            <th className="px-2 py-1.5 font-medium">Token</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.data?.map((inv) => (
            <tr key={inv.id} className="border-b border-[var(--border)] last:border-0">
              <td className="px-2 py-1.5 font-mono text-[11px]">{inv.email}</td>
              <td className="px-2 py-1.5">{inv.team.name}</td>
              <td className="px-2 py-1.5">{inv.role}</td>
              <td className="px-2 py-1.5">
                {inv.acceptedAt ? <span className="text-[var(--accent-strong)]">accepted</span> : "pending"}
              </td>
              <td className="px-2 py-1.5 text-[10px] text-[var(--foreground-muted)]">{relTime(inv.expiresAt)}</td>
              <td className="px-2 py-1.5">
                <button type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/accept-invite?token=${inv.token}`;
                    void navigator.clipboard.writeText(url);
                    toast.success("Invite link copied");
                  }}
                  className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:border-[var(--accent)]">
                  copy link
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ───────────────────────── Vault (API keys) ───────────────────────

interface VaultEntry {
  id: string;
  envKey: string;
  label: string;
  redactedValue: string;
  setAt: string;
  rotatedAt: string | null;
  lastUsedAt: string | null;
}

const SUGGESTED_KEYS = [
  { envKey: "SHODAN_API_KEY",  label: "Shodan",      sample: "Shodan host search" },
  { envKey: "HUNTER_API_KEY",  label: "Hunter.io",   sample: "Domain -> emails" },
  { envKey: "HIBP_API_KEY",    label: "HaveIBeenPwned", sample: "Email -> breaches" },
  { envKey: "CENSYS_API_ID",   label: "Censys ID",   sample: "Internet asset search" },
  { envKey: "CENSYS_API_SECRET", label: "Censys secret", sample: "(pair with the ID)" },
  { envKey: "INTELX_API_KEY",  label: "IntelX",      sample: "Dark/leak corpus search" },
];

function VaultPanel() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-vault"],
    queryFn: () => http<{ data: VaultEntry[] }>("/api/admin/vault"),
  });
  const [open, setOpen] = useState(false);
  const [envKey, setEnvKey] = useState("");
  const [label, setLabel] = useState("");
  const [plaintext, setPlaintext] = useState("");

  const put = useMutation({
    mutationFn: (body: { envKey: string; label: string; plaintext: string }) =>
      http("/api/admin/vault", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vault"] }),
  });

  const del = useMutation({
    mutationFn: (envKeyToDelete: string) =>
      http("/api/admin/vault", {
        method: "DELETE",
        body: JSON.stringify({ envKey: envKeyToDelete }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vault"] }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await put.mutateAsync({ envKey, label, plaintext });
      toast.success(`Stored ${envKey} (encrypted)`);
      setOpen(false); setEnvKey(""); setLabel(""); setPlaintext("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="glass rounded-lg p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            API key vault <span className="text-[11px] text-[var(--foreground-muted)]">({list.data?.data?.length ?? 0})</span>
          </h3>
          <p className="text-[11px] text-[var(--foreground-muted)]">
            AES-256-GCM at rest. The active AI adapter reads decrypted values via process.env at tool-call time.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded border border-[var(--border-strong)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-strong)]">
          <Plus className="h-3 w-3" /> Add key
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="mb-3 grid grid-cols-1 gap-2 rounded border border-[var(--border)] bg-[var(--background-elev)] p-3 sm:grid-cols-4">
          <select
            value={envKey}
            onChange={(e) => {
              const v = e.target.value;
              setEnvKey(v);
              const sug = SUGGESTED_KEYS.find((s) => s.envKey === v);
              if (sug && !label) setLabel(sug.label);
            }}
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]"
          >
            <option value=""> -  pick a key  - </option>
            {SUGGESTED_KEYS.map((s) => (
              <option key={s.envKey} value={s.envKey}>{s.envKey} | {s.sample}</option>
            ))}
            <option value="__custom">other (type your own)</option>
          </select>
          {envKey === "__custom" ? (
            <input value={envKey === "__custom" ? "" : envKey}
              onChange={(e) => setEnvKey(e.target.value.toUpperCase())}
              required placeholder="CUSTOM_API_KEY" pattern="[A-Z][A-Z0-9_]{2,80}"
              className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 font-mono text-[11px]" />
          ) : (
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              required placeholder="Label (e.g. 'Shodan prod')"
              className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 text-[12px]" />
          )}
          <input value={plaintext} onChange={(e) => setPlaintext(e.target.value)}
            required type="password" placeholder="Paste the key (8+ chars)"
            className="rounded border border-[var(--border)] bg-[var(--background-elev-2)] px-2 py-1.5 font-mono text-[12px]" />
          <button type="submit" disabled={put.isPending}
            className="flex items-center justify-center gap-1 rounded bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent-strong)] disabled:opacity-60">
            {put.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Store
          </button>
        </form>
      )}

      <table className="w-full text-[12px]">
        <thead className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
          <tr>
            <th className="px-2 py-1.5 font-medium">Env key</th>
            <th className="px-2 py-1.5 font-medium">Label</th>
            <th className="px-2 py-1.5 font-medium">Value</th>
            <th className="px-2 py-1.5 font-medium">Set</th>
            <th className="px-2 py-1.5 font-medium">Rotated</th>
            <th className="px-2 py-1.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.data?.map((v) => (
            <tr key={v.id} className="border-b border-[var(--border)] last:border-0">
              <td className="px-2 py-1.5">
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Key className="h-3 w-3 text-[var(--accent)]" />
                  {v.envKey}
                </span>
              </td>
              <td className="px-2 py-1.5">{v.label}</td>
              <td className="px-2 py-1.5 font-mono text-[11px] text-[var(--foreground-muted)]">{v.redactedValue}</td>
              <td className="px-2 py-1.5 text-[10px] text-[var(--foreground-muted)]">{relTime(v.setAt)}</td>
              <td className="px-2 py-1.5 text-[10px] text-[var(--foreground-muted)]">{v.rotatedAt ? relTime(v.rotatedAt) : " - "}</td>
              <td className="px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${v.envKey}?`)) {
                      del.mutate(v.envKey);
                    }
                  }}
                  className="flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--danger)] hover:border-[var(--danger)]"
                >
                  <Trash2 className="h-3 w-3" />
                  delete
                </button>
              </td>
            </tr>
          ))}
          {list.data?.data && list.data.data.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-[11px] text-[var(--foreground-muted)]">
                No keys stored. Add one above to unlock Shodan, Hunter.io, HaveIBeenPwned, etc. for the LLM tools.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

// ───────────────────────── Waitlist ──────────────────────────────

interface WaitlistRow {
  id: string;
  email: string;
  role: string | null;
  useCase: string | null;
  source: string | null;
  status: string;
  createdAt: string;
  invitedAt: string | null;
}

function WaitlistPanel() {
  const list = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () =>
      http<{ data: WaitlistRow[]; total: number }>("/api/admin/waitlist"),
  });
  const rows = list.data?.data ?? [];

  return (
    <section className="glass rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
            Waitlist
          </div>
          <div className="mt-1 text-[13px] font-medium text-[var(--foreground)]">
            Public sign-ups from the marketing landing
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--foreground-muted)]">
            Triage list. Invite flow is still manual  -  copy the email
            and reach out, then update status in the DB.
          </p>
        </div>
        <div className="text-[11px] text-[var(--foreground-muted)]">
          {list.isFetching ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> loading
            </span>
          ) : (
            <>total: {list.data?.total ?? 0}</>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--background-elev-2)] text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Use case</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center text-[12px] text-[var(--foreground-muted)]"
                >
                  No waitlist sign-ups yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--foreground)]">
                  {r.email}
                </td>
                <td className="px-3 py-2 text-[var(--foreground-muted)]">
                  {r.role ?? "-"}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-[var(--foreground-muted)]" title={r.useCase ?? ""}>
                  {r.useCase ?? "-"}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-[var(--foreground-faint)]">
                  {r.source ?? "-"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                      r.status === "invited"
                        ? "border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : r.status === "declined"
                        ? "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                        : "border-[var(--border-strong)] bg-[var(--background-elev-2)] text-[var(--foreground-muted)]",
                    )}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--foreground-muted)]">
                  {relTime(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
