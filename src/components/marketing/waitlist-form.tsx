"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type Role = "analyst" | "investigator" | "ciso" | "researcher" | "other";

const ROLES: Array<{ value: Role; label: string }> = [
  { value: "analyst", label: "OSINT analyst" },
  { value: "investigator", label: "Investigator / DFIR" },
  { value: "ciso", label: "Security leadership" },
  { value: "researcher", label: "Academic / research" },
  { value: "other", label: "Something else" },
];

interface Props {
  /** Compact = single-row email + button. Full = with role + use case. */
  variant?: "compact" | "full";
  /** Optional source tag captured in the DB (utm-style). */
  source?: string;
  /** Render style — "card" puts the form in an `fx-card`-style shell. */
  surface?: "card" | "bare";
}

export function WaitlistForm({
  variant = "full",
  source,
  surface = "card",
}: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [useCase, setUseCase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ position: number } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role: role || undefined,
          useCase: useCase.trim() || undefined,
          source,
        }),
      });
      if (res.status === 429) {
        setError("Too many sign-ups from this network. Try again in a few minutes.");
        return;
      }
      const json = (await res.json()) as
        | { data: { ok: true; position: number } }
        | { error: string; details?: unknown };
      if (!res.ok || "error" in json) {
        setError(
          "details" in json && Array.isArray(json.details)
            ? "That email doesn't look right. Mind double-checking?"
            : "Couldn't reach the server. Try again in a moment.",
        );
        return;
      }
      setDone({ position: json.data.position });
    } catch {
      setError("Network blip. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div
        className={
          surface === "card"
            ? "rounded-xl border border-[var(--accent-strong)]/40 bg-[var(--accent-soft)] p-5"
            : "rounded-xl border border-[var(--accent-strong)]/40 bg-transparent p-5"
        }
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-[var(--accent-strong)]" />
          <div>
            <div className="text-[14px] font-medium text-[var(--foreground)]">
              You&apos;re on the list — position #{done.position}.
            </div>
            <div className="mt-1 text-[12px] text-[var(--foreground-muted)]">
              Invites go out in small batches. In the meantime, the live demo is open:{" "}
              <a
                href="https://demo.forenix.tech"
                className="text-[var(--accent-strong)] underline-offset-2 hover:underline"
              >
                demo.forenix.tech
              </a>
              .
            </div>
          </div>
        </div>
      </div>
    );
  }

  const wrap =
    surface === "card"
      ? "rounded-xl border border-[var(--border)] bg-[var(--background-elev)] p-5"
      : "";

  return (
    <form onSubmit={submit} className={wrap}>
      <div className={variant === "compact" ? "flex flex-col gap-2 sm:flex-row" : "space-y-3"}>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@work.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2.5 text-[14px] text-[var(--foreground)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent-strong)] focus:outline-none"
        />
        {variant === "full" && (
          <>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role | "")}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2.5 text-[14px] text-[var(--foreground)]"
            >
              <option value="">What best describes you?</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="What would you use forenix-oss for? (optional)"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--fg-faint)] focus:border-[var(--accent-strong)] focus:outline-none"
            />
          </>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2.5 text-[13px] font-medium text-[var(--fg-on-accent)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60 sm:whitespace-nowrap"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Join waitlist <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="mt-3 text-[12px] text-[var(--danger)]">{error}</div>
      )}
      {variant === "full" && (
        <div className="mt-3 text-[11px] text-[var(--foreground-muted)]">
          We&apos;ll only email you about forenix-oss. No newsletters, no shared lists.
        </div>
      )}
    </form>
  );
}
