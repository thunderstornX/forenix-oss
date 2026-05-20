/**
 * UI-only Zustand store.
 *
 * Server data lives in TanStack Query; this store is for UI shell
 * state: active view, sidebar collapse, current investigation/case
 * focus, command-palette open state.
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const VIEWS = [
  // Argus side
  "dashboard",
  "investigations",
  "entity-graph",
  "monitors",
  "verification",
  "reports",
  // Combined
  "pipeline",
  // ForenX side
  "cases",
  "evidence",
  "network-graph",
  "branch-graph",
  "ai-lab",
  "integrity",
  "audit",
  "reviews",
  // Account + admin
  "teams",
  "settings",
  "admin",
  "waitlist-admin",
  "saas-organisations",
] as const;

export type ViewType = (typeof VIEWS)[number];

export interface NavItem {
  id: ViewType;
  label: string;
  section: "osint" | "combined" | "forensics" | "account";
  shortcut?: string;
  adminOnly?: boolean;
}

export const NAV: NavItem[] = [
  { id: "dashboard",      label: "Dashboard",      section: "osint",     shortcut: "1" },
  { id: "investigations", label: "Investigations", section: "osint",     shortcut: "2" },
  { id: "entity-graph",   label: "Entity Graph",   section: "osint",     shortcut: "3" },
  { id: "monitors",       label: "Monitors",       section: "osint",     shortcut: "4" },
  { id: "verification",   label: "Verification",   section: "osint" },
  { id: "reports",        label: "Reports",        section: "osint" },
  { id: "pipeline",       label: "Pipeline",       section: "combined",  shortcut: "5" },
  { id: "cases",          label: "Cases",          section: "forensics", shortcut: "6" },
  { id: "evidence",       label: "Evidence",       section: "forensics", shortcut: "7" },
  { id: "network-graph",  label: "Network Graph",  section: "forensics" },
  { id: "branch-graph",   label: "Branch Graph",   section: "forensics", shortcut: "8" },
  { id: "ai-lab",         label: "AI Lab",         section: "forensics", shortcut: "9" },
  { id: "integrity",      label: "Integrity",      section: "forensics" },
  { id: "audit",          label: "Audit",          section: "forensics" },
  { id: "reviews",        label: "Reviews",        section: "forensics" },
  { id: "teams",          label: "Teams",          section: "account" },
  { id: "settings",       label: "Settings",       section: "account" },
  { id: "admin",          label: "Admin",          section: "account", adminOnly: true },
  { id: "waitlist-admin", label: "Waitlist",       section: "account", adminOnly: true },
  { id: "saas-organisations", label: "Organisations", section: "account", adminOnly: true },
];

interface UIState {
  activeView: ViewType;
  sidebarCollapsed: boolean;
  activeInvestigationId: string | null;
  activeCaseId: string | null;
  commandPaletteOpen: boolean;

  setView: (v: ViewType) => void;
  toggleSidebar: () => void;
  setActiveInvestigation: (id: string | null) => void;
  setActiveCase: (id: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      activeView: "dashboard",
      sidebarCollapsed: false,
      activeInvestigationId: null,
      activeCaseId: null,
      commandPaletteOpen: false,

      setView: (v) => set({ activeView: v }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveInvestigation: (id) => set({ activeInvestigationId: id }),
      setActiveCase: (id) => set({ activeCaseId: id }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: "forenix-ui",
      partialize: (state) => ({
        activeView: state.activeView,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
