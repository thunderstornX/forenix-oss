/**
 * Shared helpers for OpenAI-compatible chat-completions endpoints
 * (OpenRouter, NVIDIA NIM, Groq, Together, Ollama's OpenAI mode, …).
 *
 * Both `OpenRouterAdapter` and `NVIDIAAdapter` reuse the same JSON
 * extraction + prompt scaffolds — the only differences are the URL,
 * the auth header, and the model id.
 *
 * NOTE: every adapter built on top of this module MUST live behind
 * `src/lib/ai/adapter.ts`. Direct imports from components or API
 * routes are forbidden.
 */
import type {
  AgentGroup,
  Confidence,
  EntityExtractionResult,
  EvidenceTagResult,
  Finding,
  InvestigationContext,
  PipelineAnalysis,
  Priority,
  SearchResult,
} from "./types";

export interface ChatBackend {
  /** Display name for logs. */
  name: string;
  /** OpenAI-compatible base URL ending in /chat/completions. */
  url: string;
  /** Returned as an HTTP header. */
  authHeader: Record<string, string>;
  /** Model id passed in the request body. */
  model: string;
  /** Cap upstream cost. */
  maxTokens?: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

const REQUEST_TIMEOUT_MS = 90_000;

export async function chatComplete(
  backend: ChatBackend,
  messages: ChatMessage[],
  opts: { temperature?: number; response_format?: "json_object" | "text" } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const body: Record<string, unknown> = {
    model: backend.model,
    messages,
    max_tokens: backend.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.response_format === "json_object") {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(backend.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...backend.authHeader,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${backend.name} HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }
    const data = (await res.json()) as ChatResponse;
    if (data.error) {
      throw new Error(`${backend.name} error: ${data.error.message ?? "unknown"}`);
    }
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error(`${backend.name}: empty completion`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Robust JSON extraction — handles ```json fences and prose. */
export function extractJson<T = unknown>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1]!.trim();
  // Find first { or [ and last matching closer.
  const first = s.search(/[{[]/);
  if (first >= 0) s = s.slice(first);
  return JSON.parse(s) as T;
}

// ────────── prompt scaffolds ──────────

const SYSTEM_PIPELINE = `You are an OSINT analyst agent. Output STRICT JSON only — no commentary,
no markdown fences. Schema:
{
  "findings": [{
    "title": string,
    "description": string,
    "confidence": "confirmed" | "probable" | "unverified" | "disputed" | "false",
    "priority": "low" | "medium" | "high" | "critical",
    "sourceName": string,
    "reasoningTrace": string
  }],
  "confidence": number,    // 0..1 — your confidence in the analysis
  "reasoningTrace": string // 1-2 sentences explaining your reasoning
}`;

const SYSTEM_ENTITIES = `You are an entity-extraction agent. Output STRICT JSON only. Schema:
{
  "entities": [{
    "name": string,
    "type": "person" | "organization" | "domain" | "ip" | "email" | "phone" | "account" | "location",
    "properties": object,
    "confidence": "confirmed" | "probable" | "unverified" | "disputed" | "false"
  }],
  "relations": [{
    "from": string, // entity name
    "to": string,   // entity name
    "relationType": string,
    "confidence": "confirmed" | "probable" | "unverified" | "disputed" | "false"
  }]
}`;

const SYSTEM_EVIDENCE_TAG = `You are a forensic-evidence triage agent. Output STRICT JSON only. Schema:
{
  "tags": string[],
  "classification": "high-interest" | "review" | "low-interest",
  "rationale": string,
  "riskScore": number   // 0..1
}`;

// ────────── adapter helpers ──────────

const VALID_CONF: ReadonlySet<Confidence> = new Set(["confirmed", "probable", "unverified", "disputed", "false"]);
const VALID_PRIO: ReadonlySet<Priority> = new Set(["low", "medium", "high", "critical"]);

function clampConf(c: unknown): Confidence {
  return typeof c === "string" && (VALID_CONF as ReadonlySet<string>).has(c) ? (c as Confidence) : "unverified";
}
function clampPrio(p: unknown): Priority {
  return typeof p === "string" && (VALID_PRIO as ReadonlySet<string>).has(p) ? (p as Priority) : "medium";
}

export async function chatAnalyzePipeline(
  backend: ChatBackend,
  target: string,
  agentGroup: AgentGroup,
  searchResults: SearchResult[],
): Promise<PipelineAnalysis> {
  // Lazy-import to dodge the heavy node:child_process surface
  // unless we actually run tools.
  const { availableToolsForGroup } = await import("@/lib/tools/registry");
  const { chatWithTools } = await import("./tool-loop");

  const tools = availableToolsForGroup(agentGroup);
  const userMsg = [
    `Target: ${target}`,
    `Agent group: ${agentGroup}`,
    "",
    tools.length > 0
      ? "You have OSINT tools available. Plan a short sequence of tool calls — start with a web search or crt.sh lookup to ground the target, then drill down with specialised tools (sherlock for usernames, holehe for emails, theHarvester for domains, etc.). Once you have real evidence, emit findings.\n"
      : (searchResults.length > 0
          ? "Sources (" + searchResults.length + "):\n" +
            searchResults.slice(0, 12).map((s, i) => `  [${i + 1}] ${s.title} — ${s.url}\n      ${s.snippet}`).join("\n") + "\n"
          : "No external data is available in this environment — base your findings on prior reasoning only.\n"),
    "",
    "When you have enough evidence, return STRICT JSON only (no prose, no fences) matching the schema in the system prompt. Produce 2-4 findings, each grounded in tool output where possible.",
  ].join("\n");

  let raw: string;
  if (tools.length > 0) {
    const loop = await chatWithTools(backend, {
      system: SYSTEM_PIPELINE,
      user: userMsg,
      tools,
      maxIterations: 6,
      temperature: 0.3,
    });
    raw = loop.text;
  } else {
    raw = await chatComplete(
      backend,
      [
        { role: "system", content: SYSTEM_PIPELINE },
        { role: "user", content: userMsg },
      ],
      { response_format: "json_object" },
    );
  }

  const parsed = extractJson<{
    findings: Array<{
      title: string;
      description: string;
      confidence?: string;
      priority?: string;
      sourceName?: string;
      reasoningTrace?: string;
    }>;
    confidence?: number;
    reasoningTrace?: string;
  }>(raw);

  const findings: Finding[] = (parsed.findings ?? []).slice(0, 6).map((f) => ({
    category: agentGroup,
    title: String(f.title ?? "(untitled)").slice(0, 240),
    description: String(f.description ?? "").slice(0, 1200),
    confidence: clampConf(f.confidence),
    sourceType: "agent",
    sourceName: String(f.sourceName ?? `${backend.name}/${agentGroup}`).slice(0, 80),
    agentGroup,
    reasoningTrace: String(f.reasoningTrace ?? "").slice(0, 800),
    priority: clampPrio(f.priority),
    evidenceRefs: searchResults.slice(0, 3).map((s) => s.url),
  }));

  const now = new Date();
  return {
    agentGroup,
    target,
    startedAt: new Date(now.getTime() - 5_000).toISOString(),
    completedAt: now.toISOString(),
    findings,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.6))),
    reasoningTrace: String(parsed.reasoningTrace ?? "").slice(0, 1200),
  };
}

export async function chatExtractEntities(
  backend: ChatBackend,
  findings: Finding[],
): Promise<EntityExtractionResult> {
  const lines = findings.slice(0, 30).map((f, i) => `[${i + 1}] (${f.agentGroup}) ${f.title} — ${f.description}`);
  const userMsg = `Extract entities + relations referenced across these findings:\n${lines.join("\n")}`;

  const raw = await chatComplete(
    backend,
    [
      { role: "system", content: SYSTEM_ENTITIES },
      { role: "user", content: userMsg },
    ],
    { response_format: "json_object" },
  );
  const parsed = extractJson<{
    entities?: Array<{ name?: string; type?: string; properties?: Record<string, unknown>; confidence?: string }>;
    relations?: Array<{ from?: string; to?: string; relationType?: string; confidence?: string }>;
  }>(raw);

  const VALID_ETYPE = new Set(["person", "organization", "domain", "ip", "email", "phone", "account", "location"]);
  return {
    entities: (parsed.entities ?? []).slice(0, 50).map((e) => ({
      name: String(e.name ?? "").slice(0, 240),
      type: (VALID_ETYPE.has(String(e.type)) ? e.type : "person") as EntityExtractionResult["entities"][number]["type"],
      properties: e.properties ?? {},
      confidence: clampConf(e.confidence),
    })).filter((e) => e.name !== ""),
    relations: (parsed.relations ?? []).slice(0, 80).map((r) => ({
      from: String(r.from ?? "").slice(0, 240),
      to: String(r.to ?? "").slice(0, 240),
      relationType: String(r.relationType ?? "associated_with").slice(0, 60),
      confidence: clampConf(r.confidence),
    })).filter((r) => r.from && r.to),
  };
}

export async function chatTagEvidence(
  backend: ChatBackend,
  evidence: { name: string; type: string; hash: string; description?: string | null; mimeType?: string | null },
): Promise<EvidenceTagResult> {
  const userMsg = [
    `Name: ${evidence.name}`,
    `Type: ${evidence.type}`,
    `MIME: ${evidence.mimeType ?? "n/a"}`,
    `Hash: ${evidence.hash}`,
    `Description: ${evidence.description ?? "(none)"}`,
  ].join("\n");
  const raw = await chatComplete(
    backend,
    [
      { role: "system", content: SYSTEM_EVIDENCE_TAG },
      { role: "user", content: userMsg },
    ],
    { response_format: "json_object" },
  );
  const parsed = extractJson<{
    tags?: unknown[];
    classification?: string;
    rationale?: string;
    riskScore?: number;
  }>(raw);

  const classOK = new Set(["high-interest", "review", "low-interest"]);
  return {
    tags: (parsed.tags ?? []).map((t) => String(t).slice(0, 60)).slice(0, 20),
    classification: classOK.has(String(parsed.classification)) ? String(parsed.classification) : "review",
    rationale: String(parsed.rationale ?? "").slice(0, 800),
    riskScore: Math.max(0, Math.min(1, Number(parsed.riskScore ?? 0.5))),
  };
}

export async function chatGenerateReport(
  backend: ChatBackend,
  investigation: InvestigationContext,
  findings: Finding[],
): Promise<string> {
  const findingsBlock = findings.slice(0, 50)
    .map((f) => `- (${f.agentGroup}, ${f.priority}, ${f.confidence}) **${f.title}** — ${f.description}`)
    .join("\n");

  const userMsg = [
    `Draft a concise markdown investigation report.`,
    ``,
    `Title: ${investigation.title}`,
    `Target: ${investigation.target}`,
    `Objective: ${investigation.objective}`,
    `Status: ${investigation.status}`,
    ``,
    `Findings (${findings.length}):`,
    findingsBlock,
    ``,
    `Output sections in this order:`,
    `1. # Executive Summary (3-5 sentences)`,
    `2. ## Findings — grouped by agent group, bullet each`,
    `3. ## Entity overview — names mentioned in the findings, no relations needed`,
    `4. ## Recommended next steps — 3-5 concrete bullet points`,
    ``,
    `Do not invent findings that aren't in the list above.`,
  ].join("\n");

  return chatComplete(
    backend,
    [
      { role: "system", content: "You produce concise, factual, markdown-formatted investigation reports." },
      { role: "user", content: userMsg },
    ],
    { temperature: 0.4 },
  );
}
