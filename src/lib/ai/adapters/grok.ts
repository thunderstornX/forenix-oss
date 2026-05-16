/**
 * GrokAdapter — xAI Grok via OpenAI-compatible chat completions.
 *
 * Setup:
 *   1. Get a key at https://console.x.ai
 *   2. Either buy credits *or* opt into the Data Sharing Program for
 *      the $150/mo free credit allotment.
 *   3. Set XAI_API_KEY=xai-… in .env
 *   4. Pick a model with XAI_MODEL (default below: grok-4-fast).
 *   5. AI_ADAPTER=grok bun dev
 *
 * NOTE: A brand-new xAI team has 0 credits by default — the API
 * returns 403 ("does not have any credits or licenses") until
 * credits are added or data-sharing is enabled. The adapter
 * surfaces that error verbatim so the analyst knows exactly what
 * to fix.
 */
import type {
  AdapterName,
  AIAdapter,
  AgentGroup,
  EntityExtractionResult,
  EvidenceTagResult,
  Finding,
  InvestigationContext,
  PipelineAnalysis,
  SearchResult,
} from "../types";
import {
  chatAnalyzePipeline,
  chatExtractEntities,
  chatGenerateReport,
  chatTagEvidence,
  type ChatBackend,
} from "../chat-completions";

const DEFAULT_MODEL = "grok-4-fast";

function backend(): ChatBackend {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GrokAdapter requires XAI_API_KEY. Get one at https://console.x.ai and add it to .env.",
    );
  }
  return {
    name: "grok",
    url: "https://api.x.ai/v1/chat/completions",
    authHeader: { authorization: `Bearer ${apiKey}` },
    model: process.env.XAI_MODEL ?? DEFAULT_MODEL,
    maxTokens: Number(process.env.XAI_MAX_TOKENS ?? 1500),
  };
}

export class GrokAdapter implements AIAdapter {
  readonly name: AdapterName = "grok";

  async analyzePipeline(
    target: string,
    agentGroup: AgentGroup,
    searchResults: SearchResult[],
  ): Promise<PipelineAnalysis> {
    return chatAnalyzePipeline(backend(), target, agentGroup, searchResults);
  }
  async extractEntities(findings: Finding[]): Promise<EntityExtractionResult> {
    return chatExtractEntities(backend(), findings);
  }
  async tagEvidence(evidence: {
    name: string; type: string; hash: string; description?: string | null; mimeType?: string | null;
  }): Promise<EvidenceTagResult> {
    return chatTagEvidence(backend(), evidence);
  }
  async generateReport(
    investigation: InvestigationContext, findings: Finding[],
  ): Promise<string> {
    return chatGenerateReport(backend(), investigation, findings);
  }
}
