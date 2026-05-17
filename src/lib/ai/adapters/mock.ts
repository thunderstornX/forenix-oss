/**
 * MockAdapter  -  deterministic, seeded, zero-network.
 *
 * Produces plausible-looking OSINT findings, entity graphs,
 * evidence tags, and report sections so the UI is demo-grade
 * without any LLM infrastructure. Outputs are deterministic for a
 * given input so screenshots stay stable across runs.
 */
import type {
  AdapterName,
  AIAdapter,
  AgentGroup,
  EntityExtractionResult,
  EvidenceTagResult,
  ExtractedEntity,
  ExtractedRelation,
  Finding,
  InvestigationContext,
  PipelineAnalysis,
  SearchResult,
} from "../types";

const PALETTE: Record<AgentGroup, { sources: string[]; tags: string[] }> = {
  identity: {
    sources: ["Identity Agent", "Username Recon", "PII Aggregator"],
    tags: ["alias", "passport", "phone", "email", "selector"],
  },
  infrastructure: {
    sources: ["WHOIS Agent", "ASN Mapper", "Cert Transparency"],
    tags: ["domain", "ip", "asn", "tls-cert", "dns"],
  },
  financial: {
    sources: ["Corp Registry Agent", "Sanctions Scanner", "Crypto Tracer"],
    tags: ["shell-co", "ubo", "sanctions", "crypto-address"],
  },
  social: {
    sources: ["Social Graph Agent", "Forum Crawler", "Imageboard Watcher"],
    tags: ["handle", "post-history", "follower", "community"],
  },
  geo: {
    sources: ["Geo Agent", "EXIF Inspector", "Satellite Cross-Ref"],
    tags: ["coords", "city", "country", "exif"],
  },
  relationships: {
    sources: ["Relation Agent", "Email Header Walker", "Co-Travel Detector"],
    tags: ["co-owner", "co-traveler", "frequent-contact"],
  },
  media: {
    sources: ["Media Agent", "Reverse Image Search", "Perceptual-Hash Matcher"],
    tags: ["photo", "phash", "video", "deepfake-suspicion"],
  },
};

/** Tiny deterministic 32-bit hash so seeded RNG doesn't drift. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let s = hash32(seed) || 1;
  return () => {
    // Park-Miller LCG. Math.imul returns a signed int32, so a naive
    // modulo can leak negative values  -  coerce to unsigned via >>> 0
    // before doing the modulo, then divide.
    const next = (Math.imul(s, 48271) >>> 0) % 2147483647;
    s = next || 1;
    return s / 2147483647;
  };
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

function fakeHash(seed: string): string {
  // 64-char hex, deterministic from seed  -  looks like a SHA-256 digest.
  const r = rng(seed + ":hash");
  let out = "";
  for (let i = 0; i < 64; i++) {
    out += Math.floor(r() * 16).toString(16);
  }
  return out;
}

const FIRST_NAMES = [
  "Mira", "Tomás", "Anya", "Olu", "Hassan", "Yuki", "Sven", "Dasha",
  "Iliana", "Ravi", "Kofi", "Camille", "Pieter", "Aleksandr", "Léa",
];
const LAST_NAMES = [
  "Volkov", "Okafor", "Hadid", "Marchetti", "Nilsson", "Patel",
  "Yamamoto", "Schreiber", "Dijkstra", "Petrenko", "Bouchard", "Rashid",
];
const ORG_FRAGMENTS = [
  "Northwind", "Cascadia", "Helix", "Borealis", "Arcadia",
  "Cobalt", "Iron Vault", "Bluestone", "Steppe", "Vermillion",
];
const TLDS = ["com", "io", "net", "co.uk", "ai", "tech", "org"];

function fakePerson(r: () => number) {
  return `${pick(FIRST_NAMES, r)} ${pick(LAST_NAMES, r)}`;
}
function fakeOrg(r: () => number) {
  return `${pick(ORG_FRAGMENTS, r)} ${pick(["Holdings", "Trading", "Logistics", "Capital", "Labs"], r)}`;
}
function fakeDomain(r: () => number) {
  return `${pick(ORG_FRAGMENTS, r).toLowerCase().replace(/\s/g, "-")}.${pick(TLDS, r)}`;
}
function fakeIp(r: () => number) {
  return `${Math.floor(r() * 223) + 1}.${Math.floor(r() * 256)}.${Math.floor(r() * 256)}.${Math.floor(r() * 254) + 1}`;
}

export class MockAdapter implements AIAdapter {
  readonly name: AdapterName = "mock";

  async analyzePipeline(
    target: string,
    agentGroup: AgentGroup,
    searchResults: SearchResult[],
  ): Promise<PipelineAnalysis> {
    const r = rng(`${target}:${agentGroup}`);
    const palette = PALETTE[agentGroup];
    const findingCount = 2 + Math.floor(r() * 3); // 2..4
    const findings: Finding[] = [];
    for (let i = 0; i < findingCount; i++) {
      const source = pick(palette.sources, r);
      findings.push({
        category: agentGroup,
        title: titleFor(agentGroup, target, r),
        description: descriptionFor(agentGroup, target, r),
        confidence: pick(["confirmed", "probable", "unverified"] as const, r),
        sourceType: "agent",
        sourceName: source,
        agentGroup,
        evidenceRefs:
          searchResults.length > 0
            ? [searchResults[Math.floor(r() * searchResults.length)]!.url]
            : [],
        priority: pick(["low", "medium", "high"] as const, r),
        reasoningTrace: `${source} cross-referenced ${searchResults.length} sources; flagged on cluster centroid.`,
      });
    }
    const now = new Date();
    const startedAt = new Date(now.getTime() - 12_000).toISOString();
    return {
      agentGroup,
      target,
      startedAt,
      completedAt: now.toISOString(),
      findings,
      confidence: 0.55 + r() * 0.4, // 0.55..0.95
      reasoningTrace:
        `Ran ${agentGroup} agents across ${searchResults.length || 8} candidate sources; ` +
        `consolidated ${findingCount} findings after de-duplication.`,
    };
  }

  async extractEntities(findings: Finding[]): Promise<EntityExtractionResult> {
    const r = rng("entity:" + findings.map((f) => f.title).join("|"));
    const entities: ExtractedEntity[] = [];
    const relations: ExtractedRelation[] = [];

    const targetPerson = fakePerson(r);
    entities.push({
      name: targetPerson,
      type: "person",
      properties: { knownLocations: [pick(["Berlin", "Lagos", "Almaty", "Lima", "Hanoi"], r)] },
      confidence: "probable",
    });
    const targetOrg = fakeOrg(r);
    entities.push({
      name: targetOrg,
      type: "organization",
      properties: { jurisdiction: pick(["UAE", "BVI", "Estonia", "Singapore"], r) },
      confidence: "probable",
    });
    relations.push({
      from: targetPerson,
      to: targetOrg,
      relationType: "controls",
      confidence: "probable",
    });

    const domain = fakeDomain(r);
    const ip = fakeIp(r);
    entities.push({
      name: domain,
      type: "domain",
      properties: { registrar: pick(["Namecheap", "Porkbun", "Gandi"], r) },
      confidence: "confirmed",
    });
    entities.push({
      name: ip,
      type: "ip",
      properties: { asn: 60000 + Math.floor(r() * 5000) },
      confidence: "confirmed",
    });
    relations.push({ from: domain, to: ip, relationType: "resolves_to", confidence: "confirmed" });
    relations.push({ from: targetOrg, to: domain, relationType: "owns", confidence: "probable" });

    return { entities, relations };
  }

  async tagEvidence(evidence: {
    name: string;
    type: string;
    hash: string;
    description?: string | null;
    mimeType?: string | null;
  }): Promise<EvidenceTagResult> {
    const r = rng("evidence:" + evidence.hash);
    const baseTags = ["mock", "auto-tagged"];
    const typeTags: Record<string, string[]> = {
      image: ["exif-present", "perceptual-hash-extracted"],
      document: ["text-extracted", "redaction-candidate"],
      log: ["timeline-relevant", "ip-rich"],
      capture: ["pcap", "tls-session-keys-found"],
    };
    const extra = typeTags[evidence.type.toLowerCase()] ?? ["unclassified"];
    const riskScore = +(0.2 + r() * 0.7).toFixed(2);
    return {
      tags: [...baseTags, ...extra],
      classification: riskScore > 0.7 ? "high-interest" : riskScore > 0.4 ? "review" : "low-interest",
      rationale:
        `Evidence "${evidence.name}" (${evidence.type}, ${evidence.mimeType ?? "n/a"}) ` +
        `was scored ${riskScore} based on hash novelty and content signals (mock heuristic).`,
      riskScore,
    };
  }

  async generateReport(
    investigation: InvestigationContext,
    findings: Finding[],
  ): Promise<string> {
    const r = rng("report:" + investigation.id);
    const grouped = groupBy(findings, (f) => f.agentGroup);
    const sections: string[] = [];

    sections.push(`# Investigation Report  -  ${investigation.title}\n`);
    sections.push(
      `**Target:** ${investigation.target}\n` +
        `**Objective:** ${investigation.objective}\n` +
        `**Status:** ${investigation.status}\n` +
        `**Report ID:** ${fakeHash(investigation.id).slice(0, 12)}\n`,
    );

    sections.push("## Executive Summary\n");
    sections.push(
      `Across ${Object.keys(grouped).length} agent groups, ${findings.length} ` +
        `findings were consolidated. The dominant signal cluster came from ` +
        `**${pick(Object.keys(grouped).length ? Object.keys(grouped) : ["identity"], r)}** ` +
        `agents. Confidence is concentrated in the *probable* band; ` +
        `${findings.filter((f) => f.confidence === "confirmed").length} ` +
        `finding(s) reached *confirmed*.`,
    );

    for (const [group, items] of Object.entries(grouped)) {
      sections.push(`\n## ${capitalize(group)} (${items.length})\n`);
      for (const f of items) {
        sections.push(
          `- **${f.title}**  -  ${f.description}  \n` +
            `  *source:* ${f.sourceName} | *confidence:* ${f.confidence} | *priority:* ${f.priority}`,
        );
      }
    }

    sections.push("\n## Recommended Next Steps\n");
    sections.push(
      "- Promote confirmed findings to forensic evidence with chain-of-custody attached.\n" +
        "- Schedule a weekly Monitor for the highest-priority targets.\n" +
        "- Cross-validate `probable` findings via a second adapter (Ollama or GLM).",
    );

    return sections.join("\n");
  }
}

// ───────────────────────── helpers ─────────────────────────────────

function titleFor(group: AgentGroup, target: string, r: () => number): string {
  const m: Record<AgentGroup, string[]> = {
    identity: [`Likely alias for ${target}`, `PII cluster near "${target}"`, `Username collision on ${target}`],
    infrastructure: [`Domain footprint around ${target}`, `Registrar lineage for ${target}`, `IP/ASN cluster co-hosting ${target}`],
    financial: [`Shell-co linked to ${target}`, `Sanctions adjacency: ${target}`, `Crypto address tied to ${target}`],
    social: [`Forum persona claiming ${target}`, `Co-follower clique for ${target}`, `Recurring narrative around ${target}`],
    geo: [`Probable base of operations for ${target}`, `EXIF cluster near ${target}`, `Satellite cross-ref hit on ${target}`],
    relationships: [`Frequent co-traveler with ${target}`, `Email-thread peers of ${target}`, `Office-mate cluster: ${target}`],
    media: [`Re-uploaded photo of ${target}`, `Perceptual-hash near-match for ${target}`, `Possible deepfake artifact: ${target}`],
  };
  return pick(m[group], r);
}

function descriptionFor(group: AgentGroup, target: string, r: () => number): string {
  const verbs = ["correlated", "cross-referenced", "clustered", "weakly linked", "strongly linked"];
  const sources = ["public registry", "open data feed", "social graph", "WHOIS snapshot", "leaked credential set"];
  return `Mock signal: ${pick(verbs, r)} ${target} against a ${pick(sources, r)} via the ${group} agent group.`;
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out as Record<K, T[]>;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
