"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

/**
 * "Try the demo" CTA shown on forenix.tech (Vercel concept surface).
 *
 * Flow on click:
 *   1. Fetch /api/demo/try — returns the public demo credentials.
 *      Returns 404 on any deployment where DEMO_VISITOR_ENABLED
 *      isn't "true" (i.e. the DigitalOcean paid surface).
 *   2. Sign the visitor in via next-auth credentials.
 *   3. Redirect to /app.
 *
 * On failure (e.g. the env got unset, or someone deep-links this
 * component to a non-Vercel deploy), fall back to the waitlist.
 *
 * Rendering this button at all is decided server-side by the parent;
 * see src/app/page.tsx for the env check. So if you're reading this,
 * the parent has already decided the button SHOULD appear.
 */
export function TryDemoButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/try", { cache: "no-store" });
      if (!res.ok) {
        // Demo isn't configured on this deploy. Redirect to the
        // waitlist as the next-best action.
        window.location.href = "/waitlist";
        return;
      }
      const json = (await res.json()) as {
        data?: { email: string; password: string };
      };
      if (!json.data) {
        setError("Demo unavailable right now. Try the waitlist instead.");
        return;
      }
      const result = await signIn("credentials", {
        email: json.data.email,
        password: json.data.password,
        redirect: false,
      });
      if (!result || result.error) {
        setError("Demo sign-in failed. Try the waitlist instead.");
        return;
      }
      window.location.href = "/app";
    } catch {
      setError("Network blip. Try again, or join the waitlist.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="cd-btn cd-btn--ghost no-underline disabled:opacity-60"
      >
        {loading ? "opening…" : "try the demo"}
        <span aria-hidden className="text-[var(--fg-faint)]">→</span>
      </button>
      {error && (
        <span className="ml-2 text-[13px] italic text-[var(--danger)]">
          {error}
        </span>
      )}
    </>
  );
}
