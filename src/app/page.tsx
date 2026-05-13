"use client";

import { useEffect } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CasesView } from "@/components/views/cases";
import { DashboardView } from "@/components/views/dashboard";
import { InvestigationsView } from "@/components/views/investigations";
import { PlaceholderView } from "@/components/views/view-shell";

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
    case "entity-graph":   return <PlaceholderView title="Entity Graph"   description="Unified entity + relation graph across investigations and cases."       phase="Phase 5" />;
    case "monitors":       return <PlaceholderView title="Monitors"       description="Cadenced re-runs of an investigation pipeline."                         phase="Phase 6" />;
    case "verification":   return <PlaceholderView title="Verification"   description="Claim-level verification with sub-claim verdicts and reasoning trace." phase="Phase 6" />;
    case "reports":        return <PlaceholderView title="Reports"        description="Investigation and case reports — published or draft."                  phase="Phase 7" />;
    case "pipeline":       return <PlaceholderView title="Pipeline"       description="Live OSINT pipeline runner with the bridge to open a forensic case."    phase="Phase 3" />;
    case "evidence":       return <PlaceholderView title="Evidence"       description="Evidence inventory with hash, commits, and chain-of-custody status."    phase="Phase 4" />;
    case "network-graph":  return <PlaceholderView title="Network Graph"  description="Cross-case network of users, agents, and merged-finding paths."        phase="Phase 5" />;
    case "branch-graph":   return <PlaceholderView title="Branch Graph"   description="Git-style branch + commit graph for the active case."                  phase="Phase 4" />;
    case "ai-lab":         return <PlaceholderView title="AI Lab"         description="Schedule and supervise agent tasks; see input, output, confidence."    phase="Phase 6" />;
    case "integrity":      return <PlaceholderView title="Integrity"      description="Verify the SHA-256 audit chain — replay every row, surface any break." phase="Phase 4" />;
    case "audit":          return <PlaceholderView title="Audit"          description="Append-only audit log across cases and investigations."                phase="Phase 4" />;
    case "reviews":        return <PlaceholderView title="Reviews"        description="Merge-request reviews on evidence branches."                           phase="Phase 4" />;
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
