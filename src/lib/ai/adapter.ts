/**
 * AI adapter factory.
 *
 * Everything that needs to call an LLM does this:
 *
 *   import { getAdapter } from "@/lib/ai/adapter";
 *   const ai = getAdapter();
 *   const report = await ai.generateReport(investigation, findings);
 *
 * The active adapter is selected by the AI_ADAPTER env var. Default
 * is "mock" so demos run with zero infrastructure. We deliberately
 * never fall through to a paid adapter.
 */
import "server-only";

import type { AdapterName, AIAdapter } from "./types";
import { MockAdapter } from "./adapters/mock";
import { OllamaAdapter } from "./adapters/ollama";
import { GLMAdapter } from "./adapters/glm";
// Premium adapters (Claude, etc.) are not shipped with OSS Core.
// They live in the private SaaS overlay that powers the hosted
// product at demo.forenix.tech. In OSS the registry still recognises
// "claude" as a valid adapter name so configuration files don't error
// silently, but construction throws with a pointer to the hosted
// product / a recommendation to use a free adapter instead.
class ClaudeAdapter implements AIAdapter {
  readonly name: AdapterName = "claude";
  constructor() {
    throw new Error(
      "ClaudeAdapter is part of the SaaS overlay and is not included in OSS Core. " +
      "Use AI_ADAPTER=mock for demos, or any of: ollama, glm, openrouter, nvidia, groq " +
      "(see .env.example for keys). The hosted product runs at https://forenix.tech.",
    );
  }
  async analyzePipeline(): Promise<never> { throw new Error("not available in OSS"); }
  async extractEntities(): Promise<never> { throw new Error("not available in OSS"); }
  async tagEvidence(): Promise<never>     { throw new Error("not available in OSS"); }
  async generateReport(): Promise<never>  { throw new Error("not available in OSS"); }
}
import { OpenRouterAdapter } from "./adapters/openrouter";
import { NVIDIAAdapter } from "./adapters/nvidia";
import { GroqAdapter } from "./adapters/groq";

const VALID: ReadonlySet<AdapterName> = new Set([
  "mock", "ollama", "glm", "claude", "openrouter", "nvidia", "groq",
]);

function resolveAdapterName(): AdapterName {
  const raw = (process.env.AI_ADAPTER ?? "mock").toLowerCase() as AdapterName;
  if (!VALID.has(raw)) {
    // Bad value -> fall back to mock, not to a paid adapter.
    console.warn(`[ai/adapter] Unknown AI_ADAPTER="${raw}"  -  falling back to "mock".`);
    return "mock";
  }
  return raw;
}

let _cached: AIAdapter | null = null;

export function getAdapter(force?: AdapterName): AIAdapter {
  if (force) {
    return construct(force);
  }
  if (!_cached) {
    _cached = construct(resolveAdapterName());
  }
  return _cached;
}

function construct(name: AdapterName): AIAdapter {
  switch (name) {
    case "mock":       return new MockAdapter();
    case "ollama":     return new OllamaAdapter();
    case "glm":        return new GLMAdapter();
    case "claude":     return new ClaudeAdapter();
    case "openrouter": return new OpenRouterAdapter();
    case "nvidia":     return new NVIDIAAdapter();
    case "groq":       return new GroqAdapter();
  }
}

/** Test-only  -  used by API routes to surface which adapter is active. */
export function activeAdapterName(): AdapterName {
  return getAdapter().name;
}

export type { AIAdapter } from "./types";
