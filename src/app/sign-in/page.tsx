"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Lock, Loader2, AlertCircle } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("admin@forenix-oss.local");
  const [password, setPassword] = useState("forenix");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Invalid email or password.");
        return;
      }
      // Hard-navigate so the server can read the cookie immediately.
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message ?? "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] p-6">
      <div className="glass-strong w-full max-w-md rounded-xl p-7 forensic-glow">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--accent-soft)] forensic-glow">
            <Lock className="h-4 w-4 text-[var(--accent-strong)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">forenix-oss</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              OSINT × Forensics
            </div>
          </div>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Sign in</h1>
        <p className="mb-5 text-[12px] text-[var(--foreground-muted)]">
          Use one of the seeded demo accounts below, or your own. All
          demo accounts use password <code className="font-mono text-[var(--accent)]">forenix</code>.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              Email
            </span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              Password
            </span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded border border-[var(--danger)] bg-[rgba(239,68,68,0.08)] p-2.5 text-[12px] text-[var(--danger)]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-[var(--accent-soft)] py-2 text-[13px] font-medium text-[var(--accent-strong)] forensic-glow disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sign in
          </button>
        </form>

        <div className="mt-5 rounded border border-[var(--border)] bg-[var(--background-elev)] p-3 text-[11px] text-[var(--foreground-muted)]">
          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
            Demo accounts
          </div>
          <ul className="space-y-0.5 font-mono text-[10px]">
            <li><b>admin@forenix-oss.local</b> · admin (full access)</li>
            <li><b>investigator@forenix-oss.local</b> · investigator</li>
            <li><b>analyst@forenix-oss.local</b> · analyst</li>
          </ul>
          <div className="mt-1">password: <code className="text-[var(--accent)]">forenix</code></div>
        </div>
      </div>
    </div>
  );
}

