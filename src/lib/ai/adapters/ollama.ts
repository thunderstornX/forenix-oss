/**
 * OllamaAdapter — talks to a local Ollama HTTP API.
 *
 * Designed for Qwen2.5-7B-instruct (or similar). Used gently so a
 * single workstation can serve all four adapter methods.
 *
 * Setup:
 *   1. Install Ollama from https://ollama.ai
 *   2. ollama pull qwen2.5:7b-instruct
 *   3. Export OLLAMA_HOST=http://localhost:11434 (default)
 *   4. AI_ADAPTER=ollama bun dev
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

export class NotImplementedError extends Error {
  constructor(setup: string) {
    super(`OllamaAdapter is not implemented yet. ${setup}`);
    this.name = "NotImplementedError";
  }
}

const SETUP_HINT =
  "Set AI_ADAPTER=mock for now, or implement the Ollama POST /api/generate call in this file. " +
  "Pull a model: `ollama pull qwen2.5:7b-instruct`.";

export class OllamaAdapter implements AIAdapter {
  readonly name: AdapterName = "ollama";

  async analyzePipeline(
    _target: string,
    _agentGroup: AgentGroup,
    _searchResults: SearchResult[],
  ): Promise<PipelineAnalysis> {
    throw new NotImplementedError(SETUP_HINT);
  }

  async extractEntities(_findings: Finding[]): Promise<EntityExtractionResult> {
    throw new NotImplementedError(SETUP_HINT);
  }

  async tagEvidence(_evidence: {
    name: string;
    type: string;
    hash: string;
  }): Promise<EvidenceTagResult> {
    throw new NotImplementedError(SETUP_HINT);
  }

  async generateReport(
    _investigation: InvestigationContext,
    _findings: Finding[],
  ): Promise<string> {
    throw new NotImplementedError(SETUP_HINT);
  }
}
