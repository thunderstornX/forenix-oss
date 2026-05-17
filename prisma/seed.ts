/**
 * Seed script for forenix-oss.
 *
 * Produces, on every clean run:
 *   - 3 users (admin, investigator, analyst)
 *   - 2 investigations  -  one `complete`, with a linked Case
 *   - 1 case with 3 evidence items, 2 EvidenceCommits per item
 *   - 6 findings (2 per investigation, 2 linked to evidence)
 *   - 1 monitor + 1 verification + 1 report per investigation
 *   - audit log entries with a valid SHA-256 prevHash chain
 *   - 2 agents with 1 AgentTask each
 *
 * The audit-log chain is appended through src/lib/audit.ts so the
 * chain that ships with seed data is the same chain the runtime
 * Integrity Dashboard verifies.
 */
import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { computeAuditHash, GENESIS_HASH } from "../src/lib/audit-chain";

const prisma = new PrismaClient();

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const DEFAULT_PW = "forenix"; // every seeded user gets this password

async function wipe() {
  // Order matters under SQLite (Cascade only fires from the parent side).
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.monitorRun.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.pipelineSchedule.deleteMany();
  await prisma.annotation.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.entityRelation.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.mergeRequest.deleteMany();
  await prisma.evidenceCommit.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.caseMetric.deleteMany();
  await prisma.caseAssignment.deleteMany();
  await prisma.agentAssignment.deleteMany();
  await prisma.agentTask.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.investigation.deleteMany();
  await prisma.case.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("[seed] wiping existing data");
  await wipe();

  // ───────────────────────── Users ─────────────────────────────
  console.log("[seed] users");
  const hash = await bcrypt.hash(DEFAULT_PW, 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@forenix-oss.local",
      name: "Admin",
      role: "admin",
      passwordHash: hash,
    },
  });
  const investigator = await prisma.user.create({
    data: {
      email: "investigator@forenix-oss.local",
      name: "Jay Investigator",
      role: "investigator",
      passwordHash: hash,
    },
  });
  const analyst = await prisma.user.create({
    data: {
      email: "analyst@forenix-oss.local",
      name: "Sam Analyst",
      role: "analyst",
      passwordHash: hash,
    },
  });

  // ───────────────────────── Team ──────────────────────────────
  console.log("[seed] team + members");
  const team = await prisma.team.create({
    data: {
      name: "Forenix Demo",
      slug: "forenix-demo",
      description: "The default team that owns the demo dataset.",
      members: {
        create: [
          { userId: admin.id,        role: "owner" },
          { userId: investigator.id, role: "admin" },
          { userId: analyst.id,      role: "member" },
        ],
      },
    },
  });

  // ───────────────────────── Case + branches + evidence ────────
  console.log("[seed] case, branches, evidence");
  const theCase = await prisma.case.create({
    data: {
      title: "Operation Sandstone",
      description:
        "Cross-jurisdictional shell-corporation network linked to a series of OSINT leads from Investigation INV-2025-019.",
      caseNumber: "CASE-2025-007",
      status: "investigating",
      priority: "high",
      progress: 35,
      teamId: team.id,
      assignments: {
        create: [
          { userId: investigator.id, role: "lead" },
          { userId: analyst.id, role: "analyst" },
        ],
      },
    },
  });

  const mainBranch = await prisma.branch.create({
    data: {
      caseId: theCase.id,
      name: "main",
      isMain: true,
      status: "active",
      color: "#10b981",
      headHash: sha("genesis:" + theCase.id),
    },
  });
  const reviewBranch = await prisma.branch.create({
    data: {
      caseId: theCase.id,
      name: "evidence-review",
      isMain: false,
      status: "active",
      color: "#7c3aed",
      parentBranch: "main",
      parentHash: mainBranch.headHash,
    },
  });

  const evidenceSpec: Array<{
    name: string;
    type: string;
    mimeType: string;
    description: string;
    size: bigint;
  }> = [
    {
      name: "smtp-headers-2025-05-02.eml",
      type: "document",
      mimeType: "message/rfc822",
      description: "Header chain showing relay through residential proxy network.",
      size: 41_220n,
    },
    {
      name: "whois-snapshot-northwind.json",
      type: "log",
      mimeType: "application/json",
      description: "WHOIS pivot for northwind-holdings.io with contact-email reuse.",
      size: 7_412n,
    },
    {
      name: "pcap-handshake-fragment.pcap",
      type: "capture",
      mimeType: "application/vnd.tcpdump.pcap",
      description: "TLS ClientHello fragment captured during outbound call to suspect VPS.",
      size: 184_320n,
    },
  ];

  const evidenceRows = [] as Array<Awaited<ReturnType<typeof prisma.evidence.create>>>;
  for (const spec of evidenceSpec) {
    const initialHash = sha(`evidence:${theCase.id}:${spec.name}:initial`);
    const evidence = await prisma.evidence.create({
      data: {
        caseId: theCase.id,
        name: spec.name,
        type: spec.type,
        mimeType: spec.mimeType,
        description: spec.description,
        size: spec.size,
        hash: initialHash,
        status: "verified",
      },
    });
    evidenceRows.push(evidence);

    // Two commits per item: "add" on main, then "verify" on evidence-review.
    const c1Hash = sha(`commit:${evidence.id}:1`);
    await prisma.evidenceCommit.create({
      data: {
        evidenceId: evidence.id,
        branchId: mainBranch.id,
        parentHash: null,
        commitHash: c1Hash,
        message: `add: ${spec.name}`,
        authorId: investigator.id,
        changeType: "add",
        diffSummary: `Initial collection  -  ${spec.size.toString()} bytes`,
      },
    });
    const c2Hash = sha(`commit:${evidence.id}:2`);
    await prisma.evidenceCommit.create({
      data: {
        evidenceId: evidence.id,
        branchId: reviewBranch.id,
        parentHash: c1Hash,
        commitHash: c2Hash,
        message: `verify: chain of custody validated for ${spec.name}`,
        authorId: analyst.id,
        changeType: "verify",
        verified: true,
        verifiedBy: analyst.name,
        verifiedAt: new Date(),
      },
    });
  }

  await prisma.branch.update({
    where: { id: mainBranch.id },
    data: { headHash: sha(`commit:${evidenceRows[2]!.id}:1`) },
  });
  await prisma.branch.update({
    where: { id: reviewBranch.id },
    data: { headHash: sha(`commit:${evidenceRows[2]!.id}:2`) },
  });

  // ───────────────────────── Agents + tasks ────────────────────
  console.log("[seed] agents");
  const reportAgent = await prisma.agent.create({
    data: {
      name: "Report Drafter",
      type: "report",
      model: "qwen2.5:7b-instruct",
      description: "Drafts investigation summaries with AI-adapter output.",
      status: "idle",
    },
  });
  const tagAgent = await prisma.agent.create({
    data: {
      name: "Evidence Tagger",
      type: "tagger",
      model: "qwen2.5:7b-instruct",
      description: "Auto-tags new Evidence rows and proposes a risk score.",
      status: "idle",
    },
  });
  await prisma.agentTask.create({
    data: {
      agentId: reportAgent.id,
      type: "report",
      status: "completed",
      input: JSON.stringify({ investigationId: "(seeded)", model: reportAgent.model }),
      output:
        "Drafted a 3-section investigation summary across identity / infrastructure / financial.",
      confidence: 0.78,
      startedAt: new Date(Date.now() - 90_000),
      completedAt: new Date(),
    },
  });
  await prisma.agentTask.create({
    data: {
      agentId: tagAgent.id,
      type: "tag",
      status: "completed",
      input: JSON.stringify({ evidenceId: evidenceRows[0]!.id }),
      output: JSON.stringify({
        tags: ["smtp", "relay", "residential-proxy"],
        riskScore: 0.71,
      }),
      confidence: 0.71,
      startedAt: new Date(Date.now() - 30_000),
      completedAt: new Date(),
    },
  });
  await prisma.agentAssignment.createMany({
    data: [
      { agentId: reportAgent.id, caseId: theCase.id, role: "drafter" },
      { agentId: tagAgent.id, caseId: theCase.id, role: "tagger" },
    ],
  });

  // ───────────────────────── Investigations + findings ─────────
  console.log("[seed] investigations");
  const inv1 = await prisma.investigation.create({
    data: {
      title: "INV-2025-019  -  Northwind Holdings",
      target: "northwind-holdings.io",
      targetType: "domain",
      objective:
        "Identify beneficial owners and infrastructure footprint of northwind-holdings.io.",
      status: "complete",
      priority: "high",
      tags: "phase-1,osint,infrastructure",
      pipelineConfig: JSON.stringify(["identity", "infrastructure", "financial"]),
      createdBy: investigator.name,
      caseId: theCase.id, // BRIDGE
      teamId: team.id,
    },
  });
  const inv2 = await prisma.investigation.create({
    data: {
      title: "INV-2025-020  -  Mira Volkov",
      target: "Mira Volkov",
      targetType: "person",
      objective:
        "Build identity profile + social adjacency map for analyst hand-off.",
      status: "running",
      priority: "medium",
      tags: "phase-1,osint,identity",
      pipelineConfig: JSON.stringify(["identity", "social", "geo"]),
      createdBy: analyst.name,
      teamId: team.id,
    },
  });

  // Findings  -  3 per investigation, 2 linked to evidence (one each).
  console.log("[seed] findings");
  await prisma.finding.createMany({
    data: [
      {
        investigationId: inv1.id,
        category: "infrastructure",
        title: "Hosting consolidates on ASN 60123",
        description:
          "Active and historical A-records resolve to a 4-IP block inside ASN 60123 (NL).",
        confidence: "confirmed",
        sourceType: "agent",
        sourceName: "WHOIS Agent",
        agentGroup: "infrastructure",
        priority: "high",
        verified: true,
        verifiedBy: analyst.name,
        evidenceId: evidenceRows[1]!.id, // BRIDGE
      },
      {
        investigationId: inv1.id,
        category: "financial",
        title: "Director overlap with Cobalt Trading Ltd (BVI)",
        description:
          "Public registry lists Director X for both Northwind Holdings and Cobalt Trading.",
        confidence: "probable",
        sourceType: "agent",
        sourceName: "Corp Registry Agent",
        agentGroup: "financial",
        priority: "medium",
      },
      {
        investigationId: inv1.id,
        category: "identity",
        title: "Re-used corporate email selector across 3 brands",
        description:
          "Identical contact-email selector observed on 3 sibling corporate sites.",
        confidence: "probable",
        sourceType: "agent",
        sourceName: "Identity Agent",
        agentGroup: "identity",
        priority: "medium",
        evidenceId: evidenceRows[0]!.id, // BRIDGE
      },
      {
        investigationId: inv2.id,
        category: "identity",
        title: "Likely alias: 'm.v.olkov'",
        description: "Username collision across 4 forum platforms.",
        confidence: "probable",
        sourceType: "agent",
        sourceName: "Username Recon",
        agentGroup: "identity",
        priority: "high",
      },
      {
        investigationId: inv2.id,
        category: "social",
        title: "Recurring co-follower clique on Mastodon",
        description: "Stable 12-account clique appears across 6 of the target's posts.",
        confidence: "unverified",
        sourceType: "agent",
        sourceName: "Social Graph Agent",
        agentGroup: "social",
        priority: "low",
      },
      {
        investigationId: inv2.id,
        category: "geo",
        title: "EXIF cluster pins activity to Almaty",
        description: "5 image uploads geo-cluster within 4 km of central Almaty.",
        confidence: "probable",
        sourceType: "agent",
        sourceName: "Geo Agent",
        agentGroup: "geo",
        priority: "medium",
      },
    ],
  });

  // ───────────────────────── Monitors + Verifications ──────────
  console.log("[seed] monitors + verifications");
  const m1 = await prisma.monitor.create({
    data: {
      investigationId: inv1.id,
      target: inv1.target,
      targetType: inv1.targetType,
      cadence: "weekly",
      status: "active",
      lastRunAt: new Date(Date.now() - 3 * 86_400_000),
      nextRunAt: new Date(Date.now() + 4 * 86_400_000),
    },
  });
  await prisma.monitorRun.create({
    data: {
      monitorId: m1.id,
      status: "complete",
      findingsCount: 1,
      result: JSON.stringify({ delta: ["new MX record observed"] }),
      startedAt: new Date(Date.now() - 3 * 86_400_000),
      completedAt: new Date(Date.now() - 3 * 86_400_000 + 60_000),
    },
  });
  await prisma.monitor.create({
    data: {
      investigationId: inv2.id,
      target: inv2.target,
      targetType: inv2.targetType,
      cadence: "daily",
      status: "active",
      nextRunAt: new Date(Date.now() + 86_400_000),
    },
  });
  await prisma.verification.create({
    data: {
      investigationId: inv1.id,
      claim: "Northwind Holdings and Cobalt Trading share a director.",
      claimType: "text",
      verdict: "probable",
      createdBy: analyst.name,
    },
  });
  await prisma.verification.create({
    data: {
      investigationId: inv2.id,
      claim: "'m.v.olkov' on forum X is the same person as the investigation target.",
      claimType: "identity",
      verdict: "pending",
      createdBy: analyst.name,
    },
  });

  // ───────────────────────── Reports ───────────────────────────
  console.log("[seed] reports");
  await prisma.report.create({
    data: {
      title: "Northwind Holdings  -  Investigation Summary",
      source: "investigation",
      investigationId: inv1.id,
      type: "summary",
      status: "published",
      sections: JSON.stringify([
        { heading: "Executive Summary", body: "Cross-jurisdictional shell network identified." },
        { heading: "Infrastructure", body: "ASN 60123 consolidation; see Finding F-1." },
        { heading: "Financial", body: "Director overlap with Cobalt Trading Ltd (BVI)." },
      ]),
      findingCount: 3,
      generatedBy: reportAgent.name,
      generatedById: admin.id,
    },
  });
  await prisma.report.create({
    data: {
      title: "Mira Volkov  -  Identity Map (draft)",
      source: "investigation",
      investigationId: inv2.id,
      type: "summary",
      status: "draft",
      sections: JSON.stringify([
        { heading: "Identity", body: "Likely alias 'm.v.olkov'." },
        { heading: "Social", body: "Co-follower clique on Mastodon." },
      ]),
      findingCount: 3,
      generatedBy: reportAgent.name,
    },
  });
  await prisma.report.create({
    data: {
      title: "Operation Sandstone  -  Forensic Status",
      source: "case",
      caseId: theCase.id,
      type: "technical",
      status: "draft",
      content:
        "## Status\n\nEvidence chain verified on review branch. 3 items collected; " +
        "2 commits per item. Outstanding: cross-reference INV-2025-020 social findings " +
        "with EML headers in `smtp-headers-2025-05-02.eml`.",
      generatedBy: "Lead Investigator",
      generatedById: investigator.id,
    },
  });

  // ───────────────────────── Pipeline schedule ─────────────────
  await prisma.pipelineSchedule.create({
    data: {
      investigationId: inv1.id,
      interval: "weekly",
      agentGroups: JSON.stringify(["infrastructure", "financial"]),
      isActive: true,
      nextRunAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });

  // ───────────────────────── Entities + relations ──────────────
  console.log("[seed] entities");
  const ePerson = await prisma.entity.create({
    data: {
      name: "Mira Volkov",
      type: "person",
      properties: JSON.stringify({ knownLocations: ["Almaty"] }),
      source: inv2.title,
      verified: false,
    },
  });
  const eOrg = await prisma.entity.create({
    data: {
      name: "Northwind Holdings",
      type: "organization",
      properties: JSON.stringify({ jurisdiction: "UAE" }),
      source: inv1.title,
      verified: true,
    },
  });
  const eDomain = await prisma.entity.create({
    data: {
      name: "northwind-holdings.io",
      type: "domain",
      properties: JSON.stringify({ registrar: "Namecheap" }),
      source: inv1.title,
      verified: true,
    },
  });
  await prisma.entityRelation.createMany({
    data: [
      {
        fromEntityId: eOrg.id,
        toEntityId: eDomain.id,
        relationType: "owns",
        confidence: "confirmed",
        investigationId: inv1.id,
      },
      {
        fromEntityId: ePerson.id,
        toEntityId: eOrg.id,
        relationType: "associated_with",
        confidence: "unverified",
        investigationId: inv2.id,
      },
    ],
  });

  // ───────────────────────── Audit log  -  hash chain ────────────
  console.log("[seed] audit log (hash chain)");
  type ChainEntry = {
    action: string;
    entity: string;
    entityId: string;
    userId: string;
    caseId?: string;
    investigationId?: string;
  };
  const chain: ChainEntry[] = [
    { action: "create_user",          entity: "User",          entityId: admin.id,        userId: admin.id },
    { action: "create_user",          entity: "User",          entityId: investigator.id, userId: admin.id },
    { action: "create_user",          entity: "User",          entityId: analyst.id,      userId: admin.id },
    { action: "create_investigation", entity: "Investigation", entityId: inv1.id,         userId: investigator.id, investigationId: inv1.id },
    { action: "run_pipeline",         entity: "Investigation", entityId: inv1.id,         userId: investigator.id, investigationId: inv1.id },
    { action: "create_case",          entity: "Case",          entityId: theCase.id,      userId: investigator.id, caseId: theCase.id },
    { action: "promote_to_evidence",  entity: "Finding",       entityId: "f-1",           userId: analyst.id,      caseId: theCase.id },
    { action: "verify_evidence",      entity: "EvidenceCommit",entityId: evidenceRows[0]!.id, userId: analyst.id, caseId: theCase.id },
    { action: "generate_report",      entity: "Report",        entityId: "r-1",           userId: admin.id,        investigationId: inv1.id },
  ];
  let prev = GENESIS_HASH;
  let auditCount = 0;
  for (const e of chain) {
    const createdAt = new Date(Date.now() - (chain.length - auditCount) * 5_000);
    const hash = computeAuditHash({
      prevHash: prev,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      createdAt,
    });
    await prisma.auditLog.create({
      data: {
        userId: e.userId,
        caseId: e.caseId,
        investigationId: e.investigationId,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        details: JSON.stringify({ seeded: true }),
        hash,
        prevHash: prev,
        createdAt,
      },
    });
    prev = hash;
    auditCount++;
  }

  console.log(`[seed] done  -  appended ${auditCount} audit entries.`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
