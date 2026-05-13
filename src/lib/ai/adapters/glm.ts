/**
 * GLMAdapter — calls Zhipu AI's GLM-4 / GLM-5 series.
 *
 * Sovereign-model option: no US-cloud dependency, but still a
 * managed API.
 *
 * Setup:
 *   1. Register at https://open.bigmodel.cn and create an API key.
 *   2. Export ZHIPU_API_KEY=...
 *   3. Pick a model: GLM_MODEL=glm-4-flash (free) or glm-4-plus (paid).
 *   4. AI_ADAPTER=glm bun dev
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

class NotImplementedError extends Error {
  constructor(setup: string) {
    super(`GLMAdapter is not implemented yet. ${setup}`);
    this.name = "NotImplementedError";
  }
}

const SETUP_HINT =
  "Set AI_ADAPTER=mock for now, or implement the POST https://open.bigmodel.cn/api/paas/v4/chat/completions " +
  "call in this file. Requires ZHIPU_API_KEY.";

export class GLMAdapter implements AIAdapter {
  readonly name: AdapterName = "glm";

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
