"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const search = useSearchParams();
  const fromParam = search.get("from");
  // Only honour `from` if it points back into the authed app — anything
  // else is treated as a redirect-attack vector and ignored.
  const dest = fromParam && fromParam.startsWith("/app") ? fromParam : "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (!res || res.error) {
        setError("That email and password didn't match. Mind trying again?");
        return;
      }
      window.location.href = dest;
    } catch (err) {
      setError((err as Error).message ?? "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cd-doc relative min-h-screen bg-[var(--bg)]">
      {/* Single accent stripe at the top, like the marketing masthead */}
      <div className="h-[3px] w-full bg-[var(--accent)]" />

      {/* Theme toggle (kept — useful for users) */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-5 top-5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {mounted ? (
          theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
        ) : (
          <span className="h-4 w-4" />
        )}
      </button>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-16">
        <Link
          href="/"
          className="block font-[family-name:var(--font-display)] text-[28px] leading-none tracking-tight text-[var(--fg-strong)] no-underline"
        >
          forenix
          <span className="italic text-[var(--accent)]">/</span>
          oss
        </Link>
        <div className="mt-1.5 cd-smallcaps text-[11px]">an open-source instrument of evidence</div>

        <hr className="cd-rule--double mt-8" />

        <div className="mt-8">
          <span className="cd-section__num">§ VI.</span>
          <h1 className="cd-section__title mt-2">Sign in.</h1>
          <p className="cd-prose mt-5 font-[family-name:var(--font-body)] text-[15px] leading-[1.55] text-[var(--fg-muted)]">
            Credentials your workspace owner issued. No SSO yet, that lands
            with the paid tier. If you are not yet admitted, the petition
            form is at{" "}
            <Link href="/waitlist" className="underline-offset-2">
              the waitlist
            </Link>
            .
          </p>
        </div>

        <form onSubmit={submit} className="mt-8">
          <label className="cd-field">
            <span className="cd-field__label">email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@team.com"
              className="cd-field__input"
            />
          </label>

          <label className="cd-field">
            <span className="cd-field__label">password</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="cd-field__input"
            />
          </label>

          {error && (
            <div role="alert" className="mt-4 border-l-2 border-[var(--danger)] pl-3 text-[13px] text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="cd-btn no-underline disabled:opacity-60"
            >
              {loading ? "signing in…" : "sign in"} <span aria-hidden>→</span>
            </button>
            <Link
              href="/waitlist"
              className="font-[family-name:var(--font-body)] text-[14px] italic text-[var(--fg-muted)] no-underline hover:text-[var(--fg-strong)]"
            >
              file a petition instead →
            </Link>
          </div>
        </form>

        <hr className="cd-rule mt-12" />

        <p className="mt-5 text-center font-mono text-[10px] text-[var(--fg-faint)]">
          MIT licensed ·{" "}
          <a
            href="https://github.com/thunderstornX/forenix-oss"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline hover:text-[var(--fg)]"
          >
            source ↗
          </a>
        </p>
      </div>
    </div>
  );
}
