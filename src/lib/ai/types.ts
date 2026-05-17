/**
 * Shared types for the AI adapter layer.
 *
 * Everything that talks to an LLM in forenix-oss goes through
 * src/lib/ai/adapter.ts → these types are the wire contract.
 */

export type AgentGroup =
  | "identity"
  | "infrastructure"
  | "financial"
  | "social"
  | "geo"
  | "relationships"
  | "media";

export type Confidence = "confirmed" | "probable" | "unverified" | "disputed" | "false";
export type Priority = "low" | "medium" | "high" | "critical";

/** A single result returned by a search backend (mock or real). */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
}

/** A finding produced by an agent run. Mirrors the Prisma Finding model. */
export interface Finding {
  id?: string;
  category: AgentGroup;
  title: string;
  description: string;
  confidence: Confidence;
  sourceType: "agent" | "manual" | "api";
  sourceName: string;
  evidenceRefs?: string[];
  rawData?: Record<string, unknown>;
  agentGroup: AgentGroup;
  reasoningTrace?: string;
  priority: Priority;
}

/** What an agent group returns when it processes a target's search results. */
export interface PipelineAnalysis {
  agentGroup: AgentGroup;
  target: string;
  startedAt: string;
  completedAt: string;
  findings: Finding[];
  reasoningTrace: string;
  /** 0..1  -  agent's own confidence in the analysis as a whole. */
  confidence: number;
}

export type EntityType =
  | "person"
  | "organization"
  | "domain"
  | "ip"
  | "email"
  | "phone"
  | "account"
  | "location";

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  properties: Record<string, unknown>;
  confidence: Confidence;
}

export interface ExtractedRelation {
  from: string; // entity name
  to: string; // entity name
  relationType: string;
  confidence: Confidence;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

/** Result of asking the AI to tag a piece of evidence. */
export interface EvidenceTagResult {
  tags: string[];
  classification: string;
  /** Free-text rationale the AI gives for the tags. */
  rationale: string;
  /** Suspicion score 0..1. */
  riskScore: number;
}

/** Investigation input the adapter needs to draft a report. */
export interface InvestigationContext {
  id: string;
  title: string;
  target: string;
  objective: string;
  status: string;
}

export type AdapterName =
  | "mock"
  | "ollama"
  | "glm"
  | "claude"
  | "openrouter"
  | "nvidia"
  | "groq";

/**
 * AIAdapter  -  every concrete adapter implements this surface.
 *
 * NOTE: Implementations are responsible for honouring upstream rate
 * limits and timeouts. Callers should treat all four methods as
 * potentially slow and possibly throwing.
 */
export interface AIAdapter {
  readonly name: AdapterName;

  analyzePipeline(
    target: string,
    agentGroup: AgentGroup,
    searchResults: SearchResult[],
  ): Promise<PipelineAnalysis>;

  extractEntities(findings: Finding[]): Promise<EntityExtractionResult>;

  tagEvidence(evidence: {
    name: string;
    type: string;
    hash: string;
    description?: string | null;
    mimeType?: string | null;
  }): Promise<EvidenceTagResult>;

  generateReport(
    investigation: InvestigationContext,
    findings: Finding[],
  ): Promise<string>;
}
