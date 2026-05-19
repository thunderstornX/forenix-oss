/**
 * ClaudeAdapter  -  calls Anthropic's Claude via @anthropic-ai/sdk.
 *
 * Lives under `src/lib/saas/` because Claude is the SaaS-premium tier
 * adapter. The class refuses to do any work unless SAAS_MODE=true; in
 * the OSS lane the constructor warns and every call throws.
 *
 * Setup (paid tier only):
 *   1. bun add @anthropic-ai/sdk
 *   2. Get a key at https://console.anthropic.com
 *   3. Export ANTHROPIC_API_KEY=sk-...
 *   4. Export SAAS_MODE=true
 *   5. AI_ADAPTER=claude bun dev
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
} from "../../ai/types";

class NotImplementedError extends Error {
  constructor(setup: string) {
    super(`ClaudeAdapter is not implemented yet. ${setup}`);
    this.name = "NotImplementedError";
  }
}

const SETUP_HINT =
  "Set AI_ADAPTER=mock for now, or implement the @anthropic-ai/sdk client call here. " +
  "Requires ANTHROPIC_API_KEY and SAAS_MODE=true.";

export class ClaudeAdapter implements AIAdapter {
  readonly name: AdapterName = "claude";

  constructor() {
    if (process.env.SAAS_MODE !== "true") {
      // Stay loud: this adapter is intentionally gated.
      console.warn(
        "[ClaudeAdapter] SAAS_MODE is not 'true'  -  Claude is intentionally a paid premium adapter.",
      );
    }
  }

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
