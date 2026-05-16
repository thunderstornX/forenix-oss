"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";

export default function AcceptInvitePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "err">("working");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("err");
      setMsg("Missing invite token in the URL.");
      return;
    }
    fetch("/api/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setState("err");
          setMsg(body?.error ?? `${r.status} ${r.statusText}`);
          return;
        }
        setState("ok");
        setMsg("You're in. Redirecting…");
        setTimeout(() => router.push("/?view=teams"), 1100);
      })
      .catch((e) => {
        setState("err");
        setMsg((e as Error).message);
      });
  }, [token, router]);

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] p-6">
      <div className="glass-strong w-full max-w-md rounded-xl p-7 forensic-glow">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Team invite</h1>
        <div className="mt-4 flex items-start gap-3">
          {state === "working" && <Loader2 className="h-5 w-5 animate-spin text-[var(--foreground-muted)]" />}
          {state === "ok"      && <CheckCircle2 className="h-5 w-5 text-[var(--accent-strong)]" />}
          {state === "err"     && <AlertOctagon  className="h-5 w-5 text-[var(--danger)]" />}
          <div>
            <div className="text-[13px] text-[var(--foreground)]">
              {state === "working" && "Accepting invite…"}
              {state === "ok"      && "Joined the team."}
              {state === "err"     && "Couldn't accept this invite."}
            </div>
            {msg && <div className="mt-1 text-[11px] text-[var(--foreground-muted)]">{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
