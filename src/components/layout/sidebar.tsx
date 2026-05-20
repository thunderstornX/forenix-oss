"use client";

import {
  ChevronLeft,
  ChevronRight,
  Search,
  LayoutDashboard,
  Telescope,
  Network,
  Radar,
  ShieldCheck,
  ScrollText,
  GitBranch,
  Workflow,
  Folders,
  Archive,
  Sparkles,
  Lock,
  Eye,
  Diff,
  Users,
  Cog,
} from "lucide-react";

import { useMe } from "@/lib/hooks";
import { NAV, type ViewType, useUI } from "@/lib/store";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<ViewType, React.ComponentType<{ className?: string }>>> = {
  "dashboard":      LayoutDashboard,
  "investigations": Telescope,
  "entity-graph":   Network,
  "monitors":       Radar,
  "verification":   ShieldCheck,
  "reports":        ScrollText,
  "pipeline":       Workflow,
  "cases":          Folders,
  "evidence":       Archive,
  "network-graph":  Network,
  "branch-graph":   GitBranch,
  "ai-lab":         Sparkles,
  "integrity":      Lock,
  "audit":          Eye,
  "reviews":        Diff,
  "teams":          Users,
  "settings":       Cog,
  "admin":          Cog,
};

const SECTION_LABELS: Record<"osint" | "combined" | "forensics" | "account", string> = {
  osint:     "OSINT",
  combined:  "Pipeline",
  forensics: "Forensics",
  account:   "Account",
};

export function Sidebar() {
  const { activeView, setView, sidebarCollapsed, toggleSidebar, setCommandPaletteOpen } = useUI();
  const me = useMe();
  const isAdmin = me.data?.data?.role === "admin";
  const userName = me.data?.data?.name ?? me.data?.data?.email ?? " - ";
  const initial = userName?.[0]?.toUpperCase() ?? "?";

  const visible = NAV.filter((n) => !n.adminOnly || isAdmin);
  const grouped = visible.reduce<Record<string, typeof NAV>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside className="fx-side">
      {/* Brand */}
      <div className="fx-side__brand">
        <div className="fx-side__mark">f</div>
        {!sidebarCollapsed && (
          <div>
            <div className="fx-side__name">forenix<em>/</em>oss</div>
            <div className="fx-side__tag">osint x forensics</div>
          </div>
        )}
      </div>

      {/* Command palette trigger */}
      {!sidebarCollapsed && (
        <div className="fx-side__search">
          <div className="fx-search">
            <span className="fx-search__icon">
              <Search size={14} />
            </span>
            <input
              type="text"
              readOnly
              placeholder="Search cases, evidence, hashes..."
              onClick={() => setCommandPaletteOpen(true)}
              className="fx-input"
            />
            <span className="fx-search__kbd">⌘K</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="fx-side__nav">
        {(["osint", "combined", "forensics", "account"] as const).map((section) => (
          <div key={section} className="fx-side__group">
            {!sidebarCollapsed && (
              <div className="fx-side__group-label">{SECTION_LABELS[section]}</div>
            )}
            <ul className="fx-stack" style={{ gap: 2 }}>
              {grouped[section]?.map((item) => {
                const Icon = ICONS[item.id] ?? LayoutDashboard;
                const isActive = activeView === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setView(item.id)}
                      aria-current={isActive ? "page" : undefined}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "fx-navitem",
                        sidebarCollapsed && "justify-center",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="fx-navitem__label">{item.label}</span>
                      )}
                      {!sidebarCollapsed && item.shortcut && (
                        <span className="fx-navitem__kbd">⌘{item.shortcut}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="fx-side__foot">
        <div className="fx-side__user">{initial}</div>
        {!sidebarCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--fg)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userName}
            </div>
            <div style={{ fontSize: "var(--fs-3xs)", color: "var(--fg-faint)" }}>
              {me.data?.data?.role ?? "viewer"}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="fx-btn fx-btn--ghost fx-btn--icon fx-btn--sm"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
