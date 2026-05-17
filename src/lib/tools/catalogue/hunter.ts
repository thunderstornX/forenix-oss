/**
 * HTTP: Hunter.io  -  domain → emails with confidence scoring.
 * Requires HUNTER_API_KEY.
 *
 * https://hunter.io/api-documentation
 */
import type { Tool } from "../types";

const DOMAIN_RE = /^[a-z0-9.-]{3,253}$/i;

export const hunterDomainTool: Tool = {
  name: "hunter_domain_emails",
  description:
    "Find public email addresses associated with a domain via " +
    "Hunter.io. Returns up to 25 emails with verification scores, " +
    "names, positions where known. Requires a Hunter API key " +
    "(admin-configured).",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Target domain." },
    },
    required: ["domain"],
  },
  kind: "http",
  groups: ["identity", "infrastructure"],
  apiKeyEnv: "HUNTER_API_KEY",
  timeoutMs: 15_000,
  maxOutputBytes: 12_000,
  async execute(args) {
    const domain = String(args.domain ?? "").trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw new Error("invalid domain");
    const key = process.env.HUNTER_API_KEY;
    if (!key) throw new Error("HUNTER_API_KEY not set in vault");
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=25&api_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`hunter HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      data?: { emails?: Array<Record<string, unknown>>; pattern?: string; organization?: string };
    };
    const emails = data.data?.emails ?? [];
    return {
      domain,
      pattern: data.data?.pattern,
      organization: data.data?.organization,
      total: emails.length,
      emails: emails.map((e) => ({
        value: e.value,
        type: e.type,
        confidence: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
        seniority: e.seniority,
      })),
    };
  },
};
