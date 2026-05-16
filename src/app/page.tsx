"use client";

import { useEffect } from "react";

import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CasesView } from "@/components/views/cases";
import { DashboardView } from "@/components/views/dashboard";
import { InvestigationsView } from "@/components/views/investigations";
import { AILabView } from "@/components/views/ai-lab";
import { AuditView } from "@/components/views/audit";
import { BranchGraphView } from "@/components/views/branch-graph";
import { EntityGraphView } from "@/components/views/entity-graph";
import { EvidenceView } from "@/components/views/evidence";
import { IntegrityView } from "@/components/views/integrity";
import { MonitorsView } from "@/components/views/monitors";
import { NetworkGraphView } from "@/components/views/network-graph";
import { PipelineView } from "@/components/views/pipeline";
import { ReportsView } from "@/components/views/reports";
import { ReviewsView } from "@/components/views/reviews";
import { VerificationView } from "@/components/views/verification";

import { NAV, useUI, type ViewType } from "@/lib/store";

const SHORTCUT_BY_VIEW: Partial<Record<string, ViewType>> = NAV.reduce(
  (acc, item) => {
    if (item.shortcut) acc[item.shortcut] = item.id;
    return acc;
  },
  {} as Partial<Record<string, ViewType>>,
);

function ViewRouter() {
  const activeView = useUI((s) => s.activeView);
  switch (activeView) {
    case "dashboard":      return <DashboardView />;
    case "investigations": return <InvestigationsView />;
    case "cases":          return <CasesView />;
    case "entity-graph":   return <EntityGraphView />;
    case "monitors":       return <MonitorsView />;
    case "verification":   return <VerificationView />;
    case "reports":        return <ReportsView />;
    case "pipeline":       return <PipelineView />;
    case "evidence":       return <EvidenceView />;
    case "network-graph":  return <NetworkGraphView />;
    case "branch-graph":   return <BranchGraphView />;
    case "ai-lab":         return <AILabView />;
    case "integrity":      return <IntegrityView />;
    case "audit":          return <AuditView />;
    case "reviews":        return <ReviewsView />;
  }
}

export default function Home() {
  const setView = useUI((s) => s.setView);
  const setActiveInv = useUI((s) => s.setActiveInvestigation);
  const setActiveCase = useUI((s) => s.setActiveCase);
  const setCommandPaletteOpen = useUI((s) => s.setCommandPaletteOpen);

  // URL query params drive initial view + selection (for deep links + screenshot capture).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const v = p.get("view") as ViewType | null;
    const inv = p.get("inv");
    const caseId = p.get("case");
    const palette = p.get("palette");
    if (v && NAV.some((n) => n.id === v)) setView(v);
    if (inv !== null) setActiveInv(inv || null);
    if (caseId !== null) setActiveCase(caseId || null);
    if (palette === "1") setCommandPaletteOpen(true);
  }, [setView, setActiveInv, setActiveCase, setCommandPaletteOpen]);

  // ⌘1–⌘9 (Ctrl on Linux/Windows) → switch view.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !/^[1-9]$/.test(e.key)) return;
      const tgt = SHORTCUT_BY_VIEW[e.key];
      if (!tgt) return;
      e.preventDefault();
      setView(tgt);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView]);

  return (
    <div className="flex h-screen w-full bg-[var(--background)]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 overflow-y-auto">
          <ViewRouter />
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
