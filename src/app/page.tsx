"use client";

import { useEffect } from "react";

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
import { PipelineView } from "@/components/views/pipeline";
import { PlaceholderView } from "@/components/views/view-shell";
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
    case "network-graph":  return <PlaceholderView title="Network Graph"  description="Cross-case network of users, agents, and merged-finding paths."        phase="Phase 5" />;
    case "branch-graph":   return <BranchGraphView />;
    case "ai-lab":         return <AILabView />;
    case "integrity":      return <IntegrityView />;
    case "audit":          return <AuditView />;
    case "reviews":        return <ReviewsView />;
  }
}

export default function Home() {
  const setView = useUI((s) => s.setView);

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
    </div>
  );
}
