/**
 * NVIDIAAdapter  -  NVIDIA NIM hosted model catalogue (build.nvidia.com).
 *
 * OpenAI-compatible chat-completions API. Free dev tier hosts
 * Nemotron, Llama 3.x, Mixtral, DeepSeek, Qwen and others at
 * https://integrate.api.nvidia.com/v1/chat/completions.
 *
 * Setup:
 *   1. Sign in at https://build.nvidia.com
 *   2. Generate a key → set NVIDIA_API_KEY=nvapi-...
 *   3. Pick a model with NVIDIA_MODEL (default below works on the
 *      free dev tier).
 *   4. AI_ADAPTER=nvidia bun dev
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

const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

function backend(): ChatBackend {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NVIDIAAdapter requires NVIDIA_API_KEY. " +
      "Get one at https://build.nvidia.com and add it to .env.",
    );
  }
  return {
    name: "nvidia",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    authHeader: { authorization: `Bearer ${apiKey}` },
    model: process.env.NVIDIA_MODEL ?? DEFAULT_MODEL,
    maxTokens: Number(process.env.NVIDIA_MAX_TOKENS ?? 1500),
  };
}

export class NVIDIAAdapter implements AIAdapter {
  readonly name: AdapterName = "nvidia";

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
