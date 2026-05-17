"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  LayoutDashboard,
  Telescope,
  Folders,
  Archive,
  GitBranch,
  Sparkles,
  Network,
  ScrollText,
  Radar,
  ShieldCheck,
  Workflow,
  Lock,
  Eye,
  Diff,
} from "lucide-react";

import { useCases, useInvestigations, useReports } from "@/lib/hooks";
import { NAV, useUI, type ViewType } from "@/lib/store";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: "Navigation" | "Investigations" | "Cases" | "Reports";
  view: ViewType;
  payload?: { investigationId?: string; caseId?: string };
  icon: React.ReactNode;
}

const VIEW_ICONS: Partial<Record<ViewType, React.ReactNode>> = {
  "dashboard":      <LayoutDashboard className="h-3.5 w-3.5" />,
  "investigations": <Telescope className="h-3.5 w-3.5" />,
  "entity-graph":   <Network className="h-3.5 w-3.5" />,
  "monitors":       <Radar className="h-3.5 w-3.5" />,
  "verification":   <ShieldCheck className="h-3.5 w-3.5" />,
  "reports":        <ScrollText className="h-3.5 w-3.5" />,
  "pipeline":       <Workflow className="h-3.5 w-3.5" />,
  "cases":          <Folders className="h-3.5 w-3.5" />,
  "evidence":       <Archive className="h-3.5 w-3.5" />,
  "network-graph":  <Network className="h-3.5 w-3.5" />,
  "branch-graph":   <GitBranch className="h-3.5 w-3.5" />,
  "ai-lab":         <Sparkles className="h-3.5 w-3.5" />,
  "integrity":      <Lock className="h-3.5 w-3.5" />,
  "audit":          <Eye className="h-3.5 w-3.5" />,
  "reviews":        <Diff className="h-3.5 w-3.5" />,
};

export function CommandPalette() {
  const open = useUI((s) => s.commandPaletteOpen);
  const setOpen = useUI((s) => s.setCommandPaletteOpen);
  const setView = useUI((s) => s.setView);
  const setInv = useUI((s) => s.setActiveInvestigation);
  const setCase = useUI((s) => s.setActiveCase);

  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const investigations = useInvestigations();
  const cases = useCases();
  const reports = useReports();

  // ⌘K / Ctrl+K global handler.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items: CommandItem[] = useMemo(() => {
    const out: CommandItem[] = [];
    for (const n of NAV) {
      out.push({
        id: `nav:${n.id}`,
        label: n.label,
        group: "Navigation",
        view: n.id,
        icon: VIEW_ICONS[n.id] ?? <LayoutDashboard className="h-3.5 w-3.5" />,
        hint: n.shortcut ? `⌘${n.shortcut}` : undefined,
      });
    }
    for (const i of investigations.data?.data ?? []) {
      out.push({
        id: `inv:${i.id}`,
        label: i.title,
        hint: i.target,
        group: "Investigations",
        view: "investigations",
        payload: { investigationId: i.id },
        icon: <Telescope className="h-3.5 w-3.5" />,
      });
    }
    for (const c of cases.data?.data ?? []) {
      out.push({
        id: `case:${c.id}`,
        label: c.title,
        hint: c.caseNumber,
        group: "Cases",
        view: "cases",
        payload: { caseId: c.id },
        icon: <Folders className="h-3.5 w-3.5" />,
      });
    }
    for (const r of reports.data?.data ?? []) {
      out.push({
        id: `rep:${r.id}`,
        label: r.title,
        hint: r.source,
        group: "Reports",
        view: "reports",
        icon: <ScrollText className="h-3.5 w-3.5" />,
      });
    }
    return out;
  }, [investigations.data, cases.data, reports.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items
      .filter((i) =>
        [i.label, i.hint ?? "", i.group].some((s) => s.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [items, query]);

  function activate(i: CommandItem) {
    if (i.payload?.investigationId) setInv(i.payload.investigationId);
    if (i.payload?.caseId) setCase(i.payload.caseId);
    setView(i.view);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const t = filtered[highlight];
      if (t) activate(t);
    }
  }

  if (!open) return null;

  // Group filtered items by group.
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start bg-[rgba(5,6,8,0.7)] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong mx-auto mt-[12vh] w-[min(680px,92vw)] overflow-hidden rounded-xl forensic-glow"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <Search className="h-4 w-4 text-[var(--foreground-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={onKey}
            placeholder="Search investigations, cases, reports, views..."
            className="w-full bg-transparent text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)]"
          />
          <kbd className="rounded bg-[var(--background-elev-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground-muted)]">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto p-1.5">
          {Object.entries(grouped).map(([group, list]) => (
            <li key={group}>
              <div className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                {group}
              </div>
              <ul>
                {list.map((item) => {
                  const idx = filtered.indexOf(item);
                  const isHighlighted = idx === highlight;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => activate(item)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px]",
                          isHighlighted
                            ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "text-[var(--foreground)] hover:bg-[var(--background-elev)]",
                        )}
                      >
                        <span className={cn("shrink-0", isHighlighted ? "text-[var(--accent-strong)]" : "text-[var(--foreground-muted)]")}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint && (
                          <span className="ml-2 shrink-0 truncate font-mono text-[10px] text-[var(--foreground-muted)]">
                            {item.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-6 text-center text-[12px] text-[var(--foreground-muted)]">
              No matches.
            </li>
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--foreground-muted)]">
          <span><kbd className="font-mono">^v</kbd> navigate | <kbd className="font-mono">⏎</kbd> open</span>
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
