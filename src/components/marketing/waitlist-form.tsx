"use client";

import { useState, type FormEvent } from "react";

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
  /** Kept for back-compat with old call sites; ignored in the document
   * register (we no longer differentiate card vs bare — the document
   * layout supplies whitespace). */
  surface?: "card" | "bare";
}

/**
 * Waitlist form in the Court Document register.
 *
 * Reads as a one-page application: small-caps labels, underlined
 * fill-in-the-blank inputs, a stamped italic primary button. On
 * success it returns a "received" notice with the position number
 * in mono.
 */
export function WaitlistForm({ variant = "full", source }: Props) {
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
      <div className="border-y border-[var(--accent)] py-6">
        <div className="cd-smallcaps text-[12px] text-[var(--accent)]">
          application received
        </div>
        <p className="mt-3 font-[family-name:var(--font-display)] text-[26px] leading-[1.15] text-[var(--fg-strong)]">
          Position{" "}
          <span className="cd-mono text-[22px] not-italic">
            #{String(done.position).padStart(4, "0")}
          </span>{" "}
          on the docket.
        </p>
        <p className="mt-3 max-w-[40em] font-[family-name:var(--font-body)] text-[15px] leading-[1.55] text-[var(--fg-muted)]">
          Invites go out in small batches. In the meantime, the full system
          is live at{" "}
          <a
            href="https://demo.forenix.tech"
            target="_blank"
            rel="noopener noreferrer"
          >
            demo.forenix.tech
          </a>
          .
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    // Inline single-row form for the masthead or sidebar uses.
    return (
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="cd-field flex-1 !my-0">
          <span className="cd-field__label">your email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@work.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="cd-field__input"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="cd-btn no-underline disabled:opacity-60"
        >
          {loading ? "filing…" : "file"} <span aria-hidden>→</span>
        </button>
        {error && (
          <div className="mt-2 w-full text-[13px] text-[var(--danger)] sm:mt-0">
            {error}
          </div>
        )}
      </form>
    );
  }

  // FULL variant — three-field document form.
  return (
    <form onSubmit={submit}>
      <label className="cd-field">
        <span className="cd-field__label">your email</span>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@work.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="cd-field__input"
        />
      </label>

      <label className="cd-field">
        <span className="cd-field__label">your role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role | "")}
          className="cd-field__select"
        >
          <option value="">how would you describe what you do</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="cd-field">
        <span className="cd-field__label">the case you would bring</span>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="a sentence or two on the investigation you would run through forenix"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          className="cd-field__textarea"
        />
      </label>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="cd-btn no-underline disabled:opacity-60"
        >
          {loading ? "filing…" : "file application"}
          <span aria-hidden>→</span>
        </button>
        <span className="font-[family-name:var(--font-body)] text-[13px] italic text-[var(--fg-muted)]">
          we only write to you about forenix; no shared lists.
        </span>
      </div>

      {error && (
        <div className="mt-4 border-l-2 border-[var(--danger)] pl-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      )}
    </form>
  );
}
