/**
 * HTTP: crt.sh — certificate transparency log search.
 *
 * No API key. Returns subdomains and TLS certs issued for a
 * domain (or wildcard). Cheap, fast, runs everywhere — works on
 * Vercel because it's just HTTPS.
 */
import type { Tool } from "../types";

const DOMAIN_RE = /^[a-z0-9.*-]{3,253}$/i;

export const crtshTool: Tool = {
  name: "crtsh_lookup",
  description:
    "Query certificate transparency logs (crt.sh) for issued " +
    "certificates matching a domain or wildcard. Returns unique " +
    "subdomains, issuer, and entry timestamps. Use for " +
    "infrastructure recon and asset discovery.",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Domain or %wildcard%." },
    },
    required: ["domain"],
  },
  kind: "http",
  groups: ["infrastructure"],
  timeoutMs: 20_000,
  maxOutputBytes: 16_000,
  async execute(args) {
    let domain = String(args.domain ?? "").trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw new Error("invalid domain");
    // Auto-add wildcard if the caller didn't.
    const q = domain.includes("%") ? domain : `%.${domain}`;
    const url = `https://crt.sh/?q=${encodeURIComponent(q)}&output=json`;
    const res = await fetch(url, {
      headers: { "user-agent": "forenix-oss/0.1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`crt.sh HTTP ${res.status}`);
    const rows = (await res.json()) as Array<{
      name_value?: string;
      issuer_name?: string;
      entry_timestamp?: string;
    }>;
    const subdomains = new Set<string>();
    const issuers = new Set<string>();
    const recent: string[] = [];
    for (const row of rows.slice(0, 1000)) {
      const names = (row.name_value ?? "").split("\n");
      for (const n of names) {
        const s = n.trim().toLowerCase();
        if (s && !s.includes(" ") && s.endsWith(domain.replace(/^%\./, ""))) {
          subdomains.add(s);
        }
      }
      if (row.issuer_name) issuers.add(row.issuer_name);
      if (row.entry_timestamp && recent.length < 10) recent.push(row.entry_timestamp);
    }
    return {
      domain,
      query: q,
      uniqueSubdomains: Array.from(subdomains).sort().slice(0, 200),
      uniqueIssuers: Array.from(issuers).slice(0, 20),
      recentEntries: recent,
      totalCerts: rows.length,
    };
  },
};
