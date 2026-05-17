"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Lock, Loader2, AlertCircle, Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message ?? "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
        padding: "var(--s-6)",
      }}
    >
      {/* Floating theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fx-btn fx-btn--ghost fx-btn--icon fx-btn--sm"
        style={{ position: "fixed", top: 16, right: 16 }}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <div className="fx-card" style={{ width: "100%", maxWidth: 420 }}>
        <div className="fx-card__body">
          <div className="fx-row" style={{ gap: 12, marginBottom: 24 }}>
            <div
              style={{
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--r-sm)",
                background: "var(--accent-soft)",
                color: "var(--accent-fg-on-soft)",
                border: "1px solid var(--accent-soft-border)",
              }}
            >
              <Lock size={16} />
            </div>
            <div>
              <div className="fx-side__name">forenix-oss</div>
              <div className="fx-side__tag">osint x forensics</div>
            </div>
          </div>

          <h1
            style={{
              fontSize: "var(--fs-xl)",
              fontWeight: 600,
              color: "var(--fg-strong)",
              margin: 0,
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            Sign in
          </h1>
          <p
            style={{
              margin: "6px 0 20px",
              fontSize: "var(--fs-sm)",
              color: "var(--fg-muted)",
            }}
          >
            Use the credentials you were issued. If you don't have an account
            yet, ask the workspace owner for an invite.
          </p>

          <form onSubmit={submit} className="fx-stack" style={{ gap: 12 }}>
            <label className="fx-stack" style={{ gap: 6 }}>
              <span className="fx-eyebrow">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="fx-input"
              />
            </label>
            <label className="fx-stack" style={{ gap: 6 }}>
              <span className="fx-eyebrow">Password</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="fx-input"
              />
            </label>

            {error && (
              <div
                className="fx-row"
                style={{
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "var(--s-3)",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--danger-border)",
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  fontSize: "var(--fs-xs)",
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="fx-btn fx-btn--primary"
              style={{ width: "100%", justifyContent: "center", height: 36 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Sign in
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
