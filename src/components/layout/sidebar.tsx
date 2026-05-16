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

  const visible = NAV.filter((n) => !n.adminOnly || isAdmin);
  const grouped = visible.reduce<Record<string, typeof NAV>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside
      className={cn(
        "glass-strong relative flex h-screen flex-col border-r border-[var(--border-strong)] transition-[width] duration-200 ease-out",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--accent-soft)] forensic-glow">
          <Lock className="h-4 w-4 text-[var(--accent-strong)]" />
        </div>
        {!sidebarCollapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[var(--foreground)]">forenix-oss</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              osint × forensics
            </div>
          </div>
        )}
      </div>

      {/* Command palette trigger */}
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className={cn(
          "mx-3 mb-4 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-2.5 py-1.5 text-[11px] text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
          sidebarCollapsed && "justify-center px-0",
        )}
      >
        <Search className="h-3.5 w-3.5" />
        {!sidebarCollapsed && (
          <>
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded bg-[var(--background-elev-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground-muted)]">
              ⌘K
            </kbd>
          </>
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {(["osint", "combined", "forensics", "account"] as const).map((section) => (
          <div key={section} className="mb-4">
            {!sidebarCollapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                {SECTION_LABELS[section]}
              </div>
            )}
            <ul className="space-y-0.5">
              {grouped[section]?.map((item) => {
                const Icon = ICONS[item.id] ?? LayoutDashboard;
                const isActive = activeView === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setView(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        isActive
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] forensic-glow"
                          : "text-[var(--foreground-muted)] hover:bg-[var(--background-elev)] hover:text-[var(--foreground)]",
                        sidebarCollapsed && "justify-center px-0",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-[var(--accent-strong)]" : "text-current",
                        )}
                      />
                      {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                      {!sidebarCollapsed && item.shortcut && (
                        <kbd className="rounded bg-[var(--background-elev-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground-muted)]">
                          ⌘{item.shortcut}
                        </kbd>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="m-3 flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background-elev)] py-1.5 text-[11px] text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        {!sidebarCollapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
