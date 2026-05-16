/**
 * OpenRouterAdapter — single key, many upstream models.
 *
 * OpenRouter is an OpenAI-compatible proxy that routes a single API
 * key to dozens of upstream providers (Anthropic, OpenAI, Mistral,
 * Meta, DeepSeek, Qwen, …). One key, the user picks the model.
 *
 * Setup:
 *   1. Sign up at https://openrouter.ai
 *   2. Create an API key → set OPENROUTER_API_KEY=sk-or-…
 *   3. Pick a model with OPENROUTER_MODEL (default below is a
 *      cost-effective free-tier-friendly model).
 *   4. AI_ADAPTER=openrouter bun dev
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

const DEFAULT_MODEL = "deepseek/deepseek-chat";

function backend(): ChatBackend {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouterAdapter requires OPENROUTER_API_KEY. " +
      "Get one at https://openrouter.ai and add it to .env.",
    );
  }
  const referer = process.env.OPENROUTER_REFERER ?? "https://github.com/thunderstornX/forenix-oss";
  const title = process.env.OPENROUTER_TITLE ?? "forenix-oss";
  return {
    name: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: {
      authorization: `Bearer ${apiKey}`,
      // OpenRouter asks integrators to identify themselves so dashboards work.
      "HTTP-Referer": referer,
      "X-Title": title,
    },
    model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    maxTokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 1500),
  };
}

export class OpenRouterAdapter implements AIAdapter {
  readonly name: AdapterName = "openrouter";

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
