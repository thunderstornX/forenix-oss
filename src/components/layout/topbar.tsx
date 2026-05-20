"use client";

import {
  Activity,
  GitMerge,
  LogOut,
  Moon,
  Palette,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { useLiveEvents } from "@/hooks/use-live-events";
import { useUI, NAV, type ViewType } from "@/lib/store";
import { useHealth, useMe } from "@/lib/hooks";
import { useTheme, type AccentKey } from "@/lib/theme";
import { cn } from "@/lib/utils";

function viewLabel(v: ViewType): string {
  return NAV.find((n) => n.id === v)?.label ?? v;
}

const ACCENTS: { key: AccentKey; label: string; swatch: string }[] = [
  { key: "emerald", label: "Emerald", swatch: "oklch(0.65 0.13 165)" },
  { key: "slate",   label: "Slate",   swatch: "oklch(0.55 0.08 250)" },
  { key: "indigo",  label: "Indigo",  swatch: "oklch(0.55 0.16 275)" },
  { key: "amber",   label: "Amber",   swatch: "oklch(0.68 0.14 70)"  },
  { key: "mono",    label: "Mono",    swatch: "oklch(0.55 0.005 250)" },
];

export function Topbar() {
  const activeView = useUI((s) => s.activeView);
  const { data: health } = useHealth();
  const { data: me } = useMe();
  const { theme, accent, toggleTheme, setAccent } = useTheme();
  const [accentOpen, setAccentOpen] = useState(false);

  // Drives the LIVE indicator. We don't care about specific topics
  // here, just whether the SSE connection is healthy.
  const { connected: liveConnected } = useLiveEvents(undefined, () => {});

  return (
    <header className="fx-top">
      <div className="fx-top__left" style={{ minWidth: 0, overflow: "hidden" }}>
        <span className="fx-top__crumb hidden lg:inline">forenix/oss</span>
        <span className="fx-top__sep hidden lg:inline">/</span>
        <h1 className="fx-top__title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {viewLabel(activeView)}
        </h1>
      </div>

      <div className="fx-top__right" style={{ flexShrink: 0 }}>
        <span
          className="fx-row hidden xl:flex"
          style={{ gap: 6 }}
          title={`adapter ${health?.adapter ?? "—"}`}
        >
          <Activity size={13} style={{ color: "var(--accent)" }} />
          adapter{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
            {health?.adapter ?? " - "}
          </span>
        </span>
        <span
          className="fx-row hidden xl:flex"
          style={{ gap: 6 }}
          title={`v${health?.version ?? "0.2.0"}`}
        >
          <GitMerge size={13} style={{ color: "var(--accent)" }} />
          v{health?.version ?? "0.2.0"}
        </span>
        <span
          className="fx-row"
          style={{ gap: 6 }}
          title={health?.status === "ok" ? "online" : "starting"}
        >
          <span className="fx-status-dot" />
          <span className="hidden lg:inline">
            {health?.status === "ok" ? "online" : "starting"}
          </span>
        </span>
        <span
          className="fx-row"
          style={{ gap: 5, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: liveConnected ? "var(--accent)" : "var(--fg-faint)" }}
          title={liveConnected ? "Receiving live events from the server" : "Live stream offline"}
        >
          <span
            aria-hidden
            style={{
              width: 6, height: 6, borderRadius: "var(--r-pill)",
              background: liveConnected ? "var(--accent)" : "var(--fg-faint)",
              boxShadow: liveConnected ? `0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent)` : undefined,
              animation: liveConnected ? "fx-pulse 1.6s ease-in-out infinite" : undefined,
            }}
          />
          <span className="hidden md:inline">live</span>
        </span>

        {/* Accent picker */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setAccentOpen((v) => !v)}
            className="fx-btn fx-btn--ghost fx-btn--icon fx-btn--sm"
            aria-label="Change accent colour"
            title="Change accent"
          >
            <Palette size={14} />
          </button>
          {accentOpen && (
            <div
              role="menu"
              onMouseLeave={() => setAccentOpen(false)}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                boxShadow: "var(--shadow-lg)",
                padding: "var(--s-2)",
                minWidth: 160,
                zIndex: 50,
              }}
            >
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={cn("fx-navitem", accent === a.key && "fx-btn--toggled")}
                  onClick={() => {
                    setAccent(a.key);
                    setAccentOpen(false);
                  }}
                  aria-current={accent === a.key ? "page" : undefined}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "var(--r-pill)",
                      background: a.swatch,
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                  <span className="fx-navitem__label">{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="fx-btn fx-btn--ghost fx-btn--icon fx-btn--sm"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {me?.data && (
          <span
            className="fx-chip fx-chip--accent"
            title={`${me.data.name ?? me.data.email} | ${me.data.role}`}
          >
            <UserIcon size={11} />
            <span className="hidden md:inline">
              {me.data.name ?? me.data.email} | {me.data.role}
            </span>
          </span>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          className="fx-btn fx-btn--ghost fx-btn--sm"
          title="Sign out"
        >
          <LogOut size={13} />
          <span className="hidden md:inline">sign out</span>
        </button>
      </div>
    </header>
  );
}
