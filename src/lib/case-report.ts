/**
 * Forensic-grade case report renderer.
 *
 * Generates a self-contained A4 HTML document for a case, suitable
 * for print-to-PDF (we ship the PDF rendering side via Playwright in
 * scripts/render_case_report.mjs; this module produces the HTML).
 *
 * Sections:
 *   1. Cover page  - case metadata + custodian + report timestamp
 *   2. Audit-chain attestation  - chain length, head hash, verifier
 *      command, prev/head sample
 *   3. Evidence inventory  - every Evidence row with hash, size,
 *      status, objectKey
 *   4. Findings  - per-investigation summary with SAT trace excerpts
 *   5. Audit log sample  - last 50 audit entries (or full if <=100)
 *
 * Layout uses the same OKLCH design tokens as the app, so the PDF
 * matches the in-app look. Light-theme only (printable).
 */
import { createHash } from "node:crypto";

import { GENESIS_HASH } from "@/lib/audit-chain";

export interface ReportEvidence {
  id: string;
  name: string;
  type: string;
  status: string;
  hash: string;
  hashAlgo: string;
  size: string | number;
  byteCount: string | number;
  objectKey: string | null;
  mimeType: string | null;
  createdAt: string | Date;
}

export interface ReportFinding {
  id: string;
  title: string;
  description: string;
  agentGroup: string;
  confidence: string;
  priority: string;
  verified: boolean;
  verifiedBy: string | null;
  reasoningTrace: string | null;
  investigationTitle: string;
}

export interface ReportAuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  hash: string;
  prevHash: string;
  createdAt: string | Date;
  actorName: string | null;
}

export interface ReportData {
  case: {
    id: string;
    caseNumber: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    progress: number;
    createdAt: string | Date;
    teamName: string | null;
    custodianName: string;
  };
  evidence: ReportEvidence[];
  findings: ReportFinding[];
  audit: ReportAuditRow[];
  attestation: {
    chainLength: number;
    headHash: string;
    genesisHash: string;
    verifyOk: boolean;
    brokenAt: string | null;
  };
  generatedAt: Date;
  generatedBy: string;
}

const HASH_SHORT = 12;

function shortHash(h: string): string {
  return h.length > HASH_SHORT ? h.slice(0, HASH_SHORT) + "..." : h;
}

function fmtDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function fmtSize(n: string | number): string {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return "-";
  if (x < 1024) return `${x} B`;
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(1)} KB`;
  if (x < 1024 ** 3) return `${(x / 1024 ** 2).toFixed(2)} MB`;
  return `${(x / 1024 ** 3).toFixed(2)} GB`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Document-level integrity digest. Hashes the report contents itself
 * so a printed/distributed PDF can be tied back to a known state of
 * the case. NOT the same as the audit chain - this is a one-shot
 * over the rendered data.
 */
export function reportDigest(d: ReportData): string {
  const blob = JSON.stringify({
    caseId: d.case.id,
    caseNumber: d.case.caseNumber,
    chainHead: d.attestation.headHash,
    chainLength: d.attestation.chainLength,
    evidenceIds: d.evidence.map((e) => e.id).sort(),
    findingIds: d.findings.map((f) => f.id).sort(),
    generatedAt: d.generatedAt.toISOString(),
  });
  return createHash("sha256").update(blob).digest("hex");
}

export function renderCaseReportHtml(d: ReportData): string {
  const digest = reportDigest(d);
  const evVerified = d.evidence.filter((e) => e.status === "verified" || e.status === "sealed").length;
  const evWithBytes = d.evidence.filter((e) => !!e.objectKey).length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(d.case.caseNumber)} - Forensic Case Report</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 16mm 14mm; }
    :root {
      --fg: #1a1d24;
      --fg-strong: #0a0c10;
      --fg-muted: #555a64;
      --fg-faint: #8a8f99;
      --bg: #ffffff;
      --bg-elev: #fcfcfd;
      --bg-sunken: #f4f5f7;
      --border: #d8dce3;
      --border-strong: #b6bbc4;
      --accent: #b86b1f;
      --accent-soft: #fbeed2;
      --accent-fg: #7a4710;
      --ok: #2f8754;
      --bad: #b9311c;
      --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
    }
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap");

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: var(--font-sans);
      font-size: 10.5px;
      line-height: 1.5;
      color: var(--fg);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3 { color: var(--fg-strong); letter-spacing: -0.01em; margin: 0; }
    h1 { font-size: 28px; font-weight: 700; line-height: 1.15; }
    h2 { font-size: 17px; font-weight: 700; margin-top: 22px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
    h3 { font-size: 12.5px; font-weight: 600; margin-top: 12px; margin-bottom: 4px; }

    .eyebrow {
      font-family: var(--font-mono);
      font-size: 8.5px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--fg-faint);
      font-weight: 600;
    }
    .mono { font-family: var(--font-mono); font-size: 10px; color: var(--fg-muted); word-break: break-all; }
    .small { font-size: 9.5px; color: var(--fg-muted); }
    .ok { color: var(--ok); font-weight: 600; }
    .bad { color: var(--bad); font-weight: 600; }
    .accent { color: var(--accent-fg); font-weight: 600; }

    .stack > * + * { margin-top: 6px; }
    .row { display: flex; gap: 10px; align-items: center; }
    .pill {
      display: inline-flex; align-items: center; gap: 5px;
      font-family: var(--font-mono);
      font-size: 8.5px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: var(--bg-sunken);
      color: var(--fg-muted);
    }
    .pill--accent {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent-fg);
    }
    .pill--ok { background: #e8f3ec; border-color: #82b797; color: var(--ok); }
    .pill--bad { background: #fbe6e3; border-color: #d68d80; color: var(--bad); }

    .cover { padding: 60px 0 30px; border-bottom: 1px solid var(--border); page-break-after: always; }
    .cover h1 { margin-top: 14px; }
    .cover .meta { margin-top: 22px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; }
    .cover .meta dt { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fg-faint); }
    .cover .meta dd { margin: 2px 0 0; font-size: 12px; color: var(--fg-strong); font-weight: 600; }

    .attestation-box {
      margin-top: 16px;
      border: 2px solid var(--accent);
      border-radius: 6px;
      padding: 14px 16px;
      background: var(--accent-soft);
    }
    .attestation-box .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }

    table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-top: 6px; }
    th, td { padding: 6px 8px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--border); }
    th { background: var(--bg-sunken); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); font-weight: 600; border-bottom: 1px solid var(--border-strong); }
    tr:last-child td { border-bottom: 0; }

    .finding { margin-top: 10px; padding: 8px 10px; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 4px; }
    .finding h3 { margin-top: 0; }
    .finding .meta { font-size: 9px; color: var(--fg-muted); margin-bottom: 4px; }
    .finding .desc { font-size: 10px; margin-top: 4px; }
    .finding .trace { margin-top: 6px; padding: 6px 8px; background: var(--bg-sunken); font-family: var(--font-mono); font-size: 8.5px; white-space: pre-wrap; word-break: break-word; border-radius: 3px; max-height: 200px; overflow: hidden; }

    footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 8.5px; color: var(--fg-faint); letter-spacing: 0.04em; }

    /* Make every section start on a fresh page where useful */
    .pagebreak { page-break-before: always; }
  </style>
</head>
<body>

  <!-- COVER -->
  <section class="cover">
    <div class="eyebrow">forenix-oss - Forensic Case Report</div>
    <h1>${esc(d.case.title)}</h1>
    <div class="small" style="margin-top:6px;">
      ${esc(d.case.caseNumber)} - status <span class="pill pill--accent">${esc(d.case.status)}</span>
      - priority <span class="pill">${esc(d.case.priority)}</span>
    </div>

    <dl class="meta">
      <div><dt>Case number</dt><dd>${esc(d.case.caseNumber)}</dd></div>
      <div><dt>Custodian</dt><dd>${esc(d.case.custodianName)}</dd></div>
      <div><dt>Team</dt><dd>${esc(d.case.teamName ?? "-")}</dd></div>
      <div><dt>Case opened</dt><dd>${esc(fmtDate(d.case.createdAt))}</dd></div>
      <div><dt>Report generated</dt><dd>${esc(fmtDate(d.generatedAt))}</dd></div>
      <div><dt>Generated by</dt><dd>${esc(d.generatedBy)}</dd></div>
    </dl>

    ${d.case.description ? `<p class="small" style="margin-top:16px; max-width:160mm;">${esc(d.case.description)}</p>` : ""}

    <div class="attestation-box">
      <div class="head">
        <div class="eyebrow accent">Chain-of-custody attestation</div>
        <span class="pill ${d.attestation.verifyOk ? "pill--ok" : "pill--bad"}">${d.attestation.verifyOk ? "verified" : "BROKEN"}</span>
      </div>
      <div class="stack">
        <div><span class="eyebrow">Chain length</span><br><span class="mono">${d.attestation.chainLength} entries</span></div>
        <div><span class="eyebrow">Head hash (sha-256)</span><br><span class="mono">${esc(d.attestation.headHash)}</span></div>
        <div><span class="eyebrow">Genesis hash</span><br><span class="mono">${esc(d.attestation.genesisHash)}</span></div>
        ${d.attestation.brokenAt ? `<div class="bad mono">Chain broken at: ${esc(d.attestation.brokenAt)}</div>` : ""}
        <div><span class="eyebrow">Report digest (sha-256)</span><br><span class="mono">${digest}</span></div>
      </div>
    </div>
  </section>

  <!-- EVIDENCE INVENTORY -->
  <h2>Evidence inventory</h2>
  <div class="small">${d.evidence.length} items - ${evVerified} verified or sealed - ${evWithBytes} backed by real file bytes on disk.</div>
  <table>
    <thead>
      <tr>
        <th style="width:22%">Name</th>
        <th>Type</th>
        <th>Status</th>
        <th>Size</th>
        <th>SHA-256</th>
        <th>Object key</th>
        <th>Added</th>
      </tr>
    </thead>
    <tbody>
      ${d.evidence.map((e) => `
        <tr>
          <td>${esc(e.name)}</td>
          <td>${esc(e.type)}${e.mimeType ? `<br><span class="small">${esc(e.mimeType)}</span>` : ""}</td>
          <td>${
            e.status === "sealed"
              ? `<span class="pill pill--accent">sealed</span>`
              : e.status === "verified"
              ? `<span class="pill pill--ok">verified</span>`
              : `<span class="pill">${esc(e.status)}</span>`
          }</td>
          <td>${esc(fmtSize(e.byteCount || e.size))}</td>
          <td class="mono" title="${esc(e.hash)}">${esc(shortHash(e.hash))}<br><span class="small">${esc(e.hashAlgo)}</span></td>
          <td class="mono" style="font-size:8.5px;">${e.objectKey ? esc(e.objectKey) : '<span class="small">(metadata-only)</span>'}</td>
          <td class="small">${esc(fmtDate(e.createdAt))}</td>
        </tr>
      `).join("")}
      ${d.evidence.length === 0 ? `<tr><td colspan="7" class="small" style="text-align:center; padding: 18px;">No evidence on this case yet.</td></tr>` : ""}
    </tbody>
  </table>

  <!-- FINDINGS -->
  <h2 class="pagebreak">Findings</h2>
  <div class="small">${d.findings.length} findings across ${new Set(d.findings.map((f) => f.investigationTitle)).size} investigations.</div>
  ${d.findings.map((f) => `
    <article class="finding">
      <h3>${esc(f.title)}</h3>
      <div class="meta">
        <span class="pill pill--accent">${esc(f.agentGroup)}</span>
        <span class="pill">${esc(f.confidence)}</span>
        <span class="pill">priority: ${esc(f.priority)}</span>
        ${f.verified ? `<span class="pill pill--ok">verified${f.verifiedBy ? ` by ${esc(f.verifiedBy)}` : ""}</span>` : ""}
        <span class="small">- ${esc(f.investigationTitle)}</span>
      </div>
      <p class="desc">${esc(f.description)}</p>
      ${f.reasoningTrace ? `<div class="trace">${esc(f.reasoningTrace.slice(0, 2400))}</div>` : ""}
    </article>
  `).join("")}
  ${d.findings.length === 0 ? `<p class="small">No findings recorded on this case.</p>` : ""}

  <!-- AUDIT LOG SAMPLE -->
  <h2 class="pagebreak">Audit log (last ${Math.min(d.audit.length, 100)} entries)</h2>
  <div class="small">Forward-linked SHA-256 chain. Verifiable offline using the recipe in <code>docs/07-SECURITY.md</code>.</div>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Action</th>
        <th>Entity</th>
        <th>Actor</th>
        <th>Hash</th>
      </tr>
    </thead>
    <tbody>
      ${d.audit.slice(-100).map((r) => `
        <tr>
          <td class="small">${esc(fmtDate(r.createdAt))}</td>
          <td>${esc(r.action)}</td>
          <td class="mono">${esc(r.entity)}<br><span class="small">${esc(r.entityId)}</span></td>
          <td>${esc(r.actorName ?? "system")}</td>
          <td class="mono" title="${esc(r.hash)}">${esc(shortHash(r.hash))}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <footer>
    <span>${esc(d.case.caseNumber)} | report digest <span class="mono">${digest.slice(0, 24)}...</span></span>
    <span>forenix-oss - github.com/thunderstornX/forenix-oss</span>
  </footer>

</body>
</html>`;
}

/** Gather everything needed for a case report from the database. */
export async function buildCaseReportData(opts: {
  caseId: string;
  generatedBy: string;
  prisma: {
    case: { findUnique: (args: unknown) => Promise<unknown> };
    evidence: { findMany: (args: unknown) => Promise<unknown[]> };
    finding: { findMany: (args: unknown) => Promise<unknown[]> };
    auditLog: { findMany: (args: unknown) => Promise<unknown[]> };
    user: { findUnique: (args: unknown) => Promise<unknown> };
  };
  verify: (rows: unknown[]) => { ok: boolean; brokenAt: string | null };
}): Promise<ReportData | null> {
  const c = (await opts.prisma.case.findUnique({
    where: { id: opts.caseId },
    include: { team: { select: { name: true } }, assignments: { include: { user: { select: { name: true, email: true } } }, where: { role: "lead" }, take: 1 } },
  })) as null | {
    id: string; caseNumber: string; title: string; description: string | null;
    status: string; priority: string; progress: number; createdAt: Date;
    team: { name: string } | null;
    assignments: Array<{ user: { name: string | null; email: string } }>;
  };
  if (!c) return null;

  const evidence = (await opts.prisma.evidence.findMany({
    where: { caseId: opts.caseId },
    orderBy: { createdAt: "desc" },
  })) as Array<{
    id: string; name: string; type: string; status: string;
    hash: string; hashAlgo: string;
    size: bigint; byteCount: bigint;
    objectKey: string | null; mimeType: string | null;
    createdAt: Date;
  }>;

  const findings = (await opts.prisma.finding.findMany({
    where: { investigation: { caseId: opts.caseId } },
    include: { investigation: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })) as Array<{
    id: string; title: string; description: string;
    agentGroup: string; confidence: string; priority: string;
    verified: boolean; verifiedBy: string | null;
    reasoningTrace: string | null;
    investigation: { title: string };
  }>;

  const audit = (await opts.prisma.auditLog.findMany({
    where: { caseId: opts.caseId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  })) as Array<{
    id: string; action: string; entity: string; entityId: string;
    hash: string; prevHash: string; createdAt: Date;
    user: { name: string | null } | null;
  }>;

  const verifyRes = opts.verify(audit);
  const head = audit.at(-1);

  return {
    case: {
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      description: c.description,
      status: c.status,
      priority: c.priority,
      progress: c.progress,
      createdAt: c.createdAt,
      teamName: c.team?.name ?? null,
      custodianName: c.assignments[0]?.user.name ?? c.assignments[0]?.user.email ?? opts.generatedBy,
    },
    evidence: evidence.map((e) => ({
      id: e.id, name: e.name, type: e.type, status: e.status,
      hash: e.hash, hashAlgo: e.hashAlgo,
      size: e.size.toString(),
      byteCount: e.byteCount.toString(),
      objectKey: e.objectKey, mimeType: e.mimeType,
      createdAt: e.createdAt,
    })),
    findings: findings.map((f) => ({
      id: f.id, title: f.title, description: f.description,
      agentGroup: f.agentGroup, confidence: f.confidence, priority: f.priority,
      verified: f.verified, verifiedBy: f.verifiedBy,
      reasoningTrace: f.reasoningTrace,
      investigationTitle: f.investigation.title,
    })),
    audit: audit.map((r) => ({
      id: r.id, action: r.action, entity: r.entity, entityId: r.entityId,
      hash: r.hash, prevHash: r.prevHash,
      createdAt: r.createdAt,
      actorName: r.user?.name ?? null,
    })),
    attestation: {
      chainLength: audit.length,
      headHash: head?.hash ?? GENESIS_HASH,
      genesisHash: GENESIS_HASH,
      verifyOk: verifyRes.ok,
      brokenAt: verifyRes.brokenAt,
    },
    generatedAt: new Date(),
    generatedBy: opts.generatedBy,
  };
}
