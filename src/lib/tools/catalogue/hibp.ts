/**
 * HTTP: HaveIBeenPwned  -  breach lookup for an email. Requires
 * HIBP_API_KEY ($3.50/mo for unlimited lookups).
 *
 * https://haveibeenpwned.com/API/v3
 *
 * For OSINT identity work: tells you which breaches an email has
 * appeared in, which often gives you the platforms it was registered
 * on, plus dates that anchor timeline reasoning.
 */
import type { Tool } from "../types";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export const hibpBreachesTool: Tool = {
  name: "hibp_breaches",
  description:
    "Look up which data breaches an email has appeared in via " +
    "HaveIBeenPwned. Returns breach names, dates, and what data " +
    "classes leaked (email, password, IP, etc.). Requires an HIBP " +
    "API key (admin-configured).",
  parameters: {
    type: "object",
    properties: {
      email: { type: "string", description: "Email address." },
      includeUnverified: {
        type: "boolean",
        description: "Default false  -  include unverified breaches.",
      },
    },
    required: ["email"],
  },
  kind: "http",
  groups: ["identity", "social"],
  apiKeyEnv: "HIBP_API_KEY",
  timeoutMs: 15_000,
  maxOutputBytes: 12_000,
  async execute(args) {
    const email = String(args.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error("invalid email");
    const includeUnverified = Boolean(args.includeUnverified);
    const key = process.env.HIBP_API_KEY;
    if (!key) throw new Error("HIBP_API_KEY not set in vault");
    const url =
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}` +
      `?truncateResponse=false&includeUnverified=${includeUnverified}`;
    const res = await fetch(url, {
      headers: {
        "hibp-api-key": key,
        "user-agent": "forenix-oss/0.1",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 404) return { email, found: false, breaches: [] };
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`hibp HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as Array<Record<string, unknown>>;
    return {
      email,
      found: data.length > 0,
      total: data.length,
      breaches: data.slice(0, 25).map((b) => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        breachDate: b.BreachDate,
        pwnCount: b.PwnCount,
        dataClasses: b.DataClasses,
        isVerified: b.IsVerified,
        isSensitive: b.IsSensitive,
      })),
    };
  },
};
