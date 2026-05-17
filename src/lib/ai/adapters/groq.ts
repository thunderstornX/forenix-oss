/**
 * GroqAdapter  -  Groq's LPU-accelerated chat completions.
 *
 * NB: "Groq" (the LPU inference company) is NOT "Grok" (xAI's
 * model). Two very different products, confusingly-similar names.
 *
 * Free tier is generous and card-free:
 *   - 30 req/min, 14,400 req/day on `llama-3.3-70b-versatile`.
 *   - Median latency ~150 ms  -  easily the fastest of all the
 *     adapters in this build.
 *
 * Setup:
 *   1. Sign up at https://console.groq.com (no card).
 *   2. Create a key → set GROQ_API_KEY=gsk_...
 *   3. (Optional) override GROQ_MODEL  -  default below works.
 *   4. AI_ADAPTER=groq bun dev
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

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

function backend(): ChatBackend {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GroqAdapter requires GROQ_API_KEY. Get one (free, no card) at https://console.groq.com.",
    );
  }
  return {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    authHeader: { authorization: `Bearer ${apiKey}` },
    model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
    maxTokens: Number(process.env.GROQ_MAX_TOKENS ?? 1500),
  };
}

export class GroqAdapter implements AIAdapter {
  readonly name: AdapterName = "groq";

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
