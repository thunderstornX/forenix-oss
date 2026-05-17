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

  return (
    <header className="fx-top">
      <div className="fx-top__left">
        <span className="fx-top__crumb">forenix-oss</span>
        <span className="fx-top__sep">/</span>
        <h1 className="fx-top__title">{viewLabel(activeView)}</h1>
      </div>

      <div className="fx-top__right">
        <span className="fx-row" style={{ gap: 6 }}>
          <Activity size={13} style={{ color: "var(--accent)" }} />
          adapter{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>
            {health?.adapter ?? "—"}
          </span>
        </span>
        <span className="fx-row" style={{ gap: 6 }}>
          <GitMerge size={13} style={{ color: "var(--accent)" }} />
          v{health?.version ?? "0.2.0"}
        </span>
        <span className="fx-row" style={{ gap: 6 }}>
          <span className="fx-status-dot" />
          {health?.status === "ok" ? "online" : "starting"}
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
          <span className="fx-chip fx-chip--accent">
            <UserIcon size={11} />
            {me.data.name ?? me.data.email} · {me.data.role}
          </span>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          className="fx-btn fx-btn--ghost fx-btn--sm"
        >
          <LogOut size={13} />
          sign out
        </button>
      </div>
    </header>
  );
}
