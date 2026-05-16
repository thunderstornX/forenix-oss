/**
 * Tool-use loop on top of OpenAI-compatible chat completions.
 *
 * Given a model + a tool catalogue, runs the standard
 * call → tool_call(s) → tool_result(s) → call → ... → final_text
 * loop, up to maxIterations.
 *
 * Works against any provider whose chat-completions endpoint
 * accepts `tools` + returns `choices[].message.tool_calls`
 * (OpenRouter, NVIDIA NIM, Groq, Anthropic-via-OpenAI compat,
 * Together, …).
 */
import type { ChatBackend } from "./chat-completions";
import { runToolCall } from "@/lib/tools/runner";
import type { Tool, ToolCall, ToolResult } from "@/lib/tools/types";
import { toolsAsOpenAISchema } from "@/lib/tools/registry";

interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface ChatResp {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

const REQUEST_TIMEOUT_MS = 90_000;

export interface ToolLoopResult {
  /** Final assistant text. */
  text: string;
  /** Every tool invocation that happened during the loop. */
  toolCalls: ToolResult[];
  /** Number of model calls made. */
  iterations: number;
}

export async function chatWithTools(
  backend: ChatBackend,
  opts: {
    system: string;
    user: string;
    tools: Tool[];
    maxIterations?: number;
    temperature?: number;
  },
): Promise<ToolLoopResult> {
  const maxIter = opts.maxIterations ?? 6;
  const schema = toolsAsOpenAISchema(opts.tools);
  const messages: ChatMsg[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const callLog: ToolResult[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const data = await callModel(backend, messages, schema, opts.temperature);
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error(`${backend.name}: empty choice`);

    // Push the assistant response onto history regardless.
    messages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // No tools requested → final answer.
      return {
        text: msg.content ?? "",
        toolCalls: callLog,
        iterations: iter + 1,
      };
    }

    // Execute every requested tool, in parallel where safe.
    const calls: ToolCall[] = msg.tool_calls.map((c) => ({
      id: c.id,
      name: c.function.name,
      args: safeParseArgs(c.function.arguments),
    }));
    const results = await Promise.all(
      calls.map(async (call) => {
        const tool = opts.tools.find((t) => t.name === call.name);
        if (!tool) {
          return {
            id: call.id,
            name: call.name,
            ok: false,
            output: null,
            durationMs: 0,
            error: `unknown tool: ${call.name}`,
          } satisfies ToolResult;
        }
        return runToolCall(tool, call);
      }),
    );
    callLog.push(...results);

    // Feed every result back as a tool message.
    for (const r of results) {
      messages.push({
        role: "tool",
        tool_call_id: r.id,
        name: r.name,
        content: JSON.stringify({
          ok: r.ok,
          output: r.output,
          error: r.error,
          durationMs: r.durationMs,
        }),
      });
    }
  }

  // We hit maxIter without the model giving up its tool habit; ask
  // for a final answer with no tools.
  const final = await callModel(backend, messages, [], opts.temperature, true);
  const text = final.choices?.[0]?.message?.content ?? "";
  return { text, toolCalls: callLog, iterations: maxIter + 1 };
}

function safeParseArgs(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

async function callModel(
  backend: ChatBackend,
  messages: ChatMsg[],
  schema: ReturnType<typeof toolsAsOpenAISchema>,
  temperature?: number,
  forceFinal?: boolean,
): Promise<ChatResp> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model: backend.model,
      messages,
      max_tokens: backend.maxTokens ?? 1500,
      temperature: temperature ?? 0.3,
    };
    if (!forceFinal && schema.length > 0) {
      body.tools = schema;
      body.tool_choice = "auto";
    }
    const res = await fetch(backend.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...backend.authHeader },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${backend.name} HTTP ${res.status}: ${txt.slice(0, 300)}`);
    }
    const data = (await res.json()) as ChatResp;
    if (data.error) {
      throw new Error(`${backend.name} error: ${data.error.message ?? "unknown"}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
