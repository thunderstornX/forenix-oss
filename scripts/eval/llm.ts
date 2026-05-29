/**
 * Minimal, self-contained LLM plumbing for the RQ2 harness.
 *
 * The system-under-test (SUT) is driven through the product pipeline
 * (chatAnalyzePipeline), which takes a ChatBackend — built here. The
 * judge is a DIFFERENT provider/model, called via a plain fetch, to
 * reduce a model's self-preference bias when grading its own output.
 */
import type { ChatBackend } from "@/lib/ai/chat-completions";

/** System-under-test: Groq llama-3.3-70b by default (free, fast). */
export function sutBackend(): ChatBackend {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY required for the system-under-test");
  return {
    name: "groq-sut",
    url: "https://api.groq.com/openai/v1/chat/completions",
    authHeader: { authorization: `Bearer ${apiKey}` },
    model: process.env.EVAL_SUT_MODEL ?? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    maxTokens: 1500,
  };
}

/** Judge: a different model (OpenRouter) so it isn't grading itself. */
export function judgeBackend(): ChatBackend {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY required for the judge");
  return {
    name: "openrouter-judge",
    url: "https://openrouter.ai/api/v1/chat/completions",
    authHeader: { authorization: `Bearer ${apiKey}` },
    model: process.env.EVAL_JUDGE_MODEL ?? "openai/gpt-oss-120b:free",
    maxTokens: 1200,
  };
}

/** One chat round-trip. Temperature 0 for the most repeatable output. */
export async function rawChat(
  backend: ChatBackend,
  messages: Array<{ role: "system" | "user"; content: string }>,
  opts?: { json?: boolean },
): Promise<string> {
  const body: Record<string, unknown> = {
    model: backend.model,
    messages,
    temperature: 0,
    max_tokens: backend.maxTokens ?? 1200,
  };
  if (opts?.json) body.response_format = { type: "json_object" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(backend.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...backend.authHeader },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`${backend.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
