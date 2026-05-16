/**
 * GET /api/settings
 *
 * Authenticated user reads which adapter is wired, which keys are
 * present (redacted), and the SaaS-mode flag. Useful for the
 * Settings view to explain "why is the chip showing X".
 *
 * Note: this never returns actual key values — only "present" booleans.
 */
import { httpErrorResponse, requireSession } from "@/lib/rbac";

const ADAPTERS = [
  { name: "mock",       cost: "free",       envKey: null,                model: null },
  { name: "ollama",     cost: "free",       envKey: "OLLAMA_HOST",       model: "OLLAMA_MODEL" },
  { name: "glm",        cost: "free tier",  envKey: "ZHIPU_API_KEY",     model: "GLM_MODEL" },
  { name: "claude",     cost: "paid",       envKey: "ANTHROPIC_API_KEY", model: null,           saasOnly: true },
  { name: "openrouter", cost: "free + paid",envKey: "OPENROUTER_API_KEY",model: "OPENROUTER_MODEL" },
  { name: "nvidia",     cost: "free dev",   envKey: "NVIDIA_API_KEY",    model: "NVIDIA_MODEL" },
  { name: "groq",       cost: "free, no card", envKey: "GROQ_API_KEY",   model: "GROQ_MODEL" },
] as const;

export async function GET() {
  try {
    await requireSession();
    const active = (process.env.AI_ADAPTER ?? "mock").toLowerCase();
    const saasMode = process.env.SAAS_MODE === "true";

    const adapters = ADAPTERS.map((a) => ({
      name: a.name,
      cost: a.cost,
      envKey: a.envKey,
      model: a.model,
      modelValue: a.model ? process.env[a.model] ?? null : null,
      keyPresent: a.envKey ? Boolean(process.env[a.envKey]) : true,
      saasOnly: "saasOnly" in a ? a.saasOnly : false,
      active: a.name === active,
    }));

    return Response.json({
      data: {
        activeAdapter: active,
        saasMode,
        version: "0.1.0",
        adapters,
      },
    });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
