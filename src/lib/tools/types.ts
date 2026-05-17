/**
 * Tool registry types  -  the contract every OSINT tool implements.
 *
 * Mirrors the OpenAI function-calling shape so any tool-capable
 * model (Claude / OpenRouter / NVIDIA / Groq / GLM) can use them
 * directly.
 */

export type AgentGroup =
  | "identity"
  | "infrastructure"
  | "financial"
  | "social"
  | "geo"
  | "relationships"
  | "media";

export type ToolKind = "subprocess" | "http" | "builtin";

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  enum?: unknown[];
  items?: unknown;
}

/** The shape every tool must export. */
export interface Tool {
  /** A short snake_case identifier the LLM will use in tool_calls. */
  name: string;
  /** Human + LLM-readable description. */
  description: string;
  /** JSON-schema-shaped parameter list (OpenAI tool-call style). */
  parameters: {
    type: "object";
    properties: Record<string, JsonSchema>;
    required?: string[];
  };
  /** Implementation backing  -  informs the runner how to dispatch. */
  kind: ToolKind;
  /** Which agent groups should see this tool. */
  groups: AgentGroup[];
  /** Does it need an API key? If so, env var name. Admins set this. */
  apiKeyEnv?: string;
  /** Soft cap on output bytes returned to the LLM. */
  maxOutputBytes?: number;
  /** Hard timeout in ms (default 30 s). */
  timeoutMs?: number;
  /** The actual function. Receives validated args, returns JSON-able. */
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  ok: boolean;
  /** Truncated to maxOutputBytes. */
  output: unknown;
  durationMs: number;
  error?: string;
}
