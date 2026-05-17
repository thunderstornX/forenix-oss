"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Moon,
  Sun,
} from "lucide-react";

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
  // Only honour `from` if it points back into the authed app —
  // anything else is treated as a redirect-attack vector and ignored.
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
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <BackgroundAura />

      {/* Floating theme toggle (same posture as the marketing nav) */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background-elev)]/70 text-[var(--foreground-muted)] backdrop-blur hover:text-[var(--foreground)]"
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {mounted ? (
          theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
        ) : (
          <span className="h-4 w-4" />
        )}
      </button>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight"
        >
          <Glyph />
          <span>forenix<span className="text-[var(--accent-strong)]">-oss</span></span>
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-elev)]/80 p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <h1 className="font-[family-name:var(--font-display)] text-[32px] font-normal leading-none tracking-[-0.01em] text-[var(--foreground)]">
            Sign <span className="italic text-[var(--accent-strong)]">in</span>.
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
            Credentials your workspace owner issued. No SSO yet — that lands with
            the paid tier.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@team.com"
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-[var(--danger)]/50 bg-[rgba(239,68,68,0.06)] p-2.5 text-[12px] text-[var(--danger)]"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-strong)] px-4 py-2.5 text-[14px] font-medium text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-faint)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            or
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <Link
            href="/waitlist"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-transparent px-4 py-2.5 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--background-elev-2)]"
          >
            Don&apos;t have access yet? Join the waitlist
          </Link>
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--foreground-muted)]">
          MIT licensed. Source at{" "}
          <a
            href="https://github.com/thunderstornX/forenix-oss"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--foreground)] hover:underline"
          >
            github.com/thunderstornX/forenix-oss
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  autoComplete,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
        {label}
      </span>
      <input
        required
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-md border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus:border-[var(--accent-strong)] focus:outline-none"
      />
    </label>
  );
}

function Glyph() {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--accent-strong)]/50 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </span>
  );
}

function BackgroundAura() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--accent-strong) 28%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--foreground-faint) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 85%)",
        }}
      />
    </div>
  );
}
