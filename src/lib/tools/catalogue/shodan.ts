/**
 * HTTP: Shodan host search. Requires SHODAN_API_KEY.
 *
 * https://developer.shodan.io/api
 *
 * Returns open ports, banners, hostname, ASN, country for a given
 * IPv4  -  the bread-and-butter input for infrastructure analysis.
 */
import type { Tool } from "../types";

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export const shodanHostTool: Tool = {
  name: "shodan_host",
  description:
    "Look up the Shodan host record for an IPv4. Returns open " +
    "ports, service banners, hostnames, ASN, country, and last-seen " +
    "timestamps. Requires a Shodan API key (admin-configured).",
  parameters: {
    type: "object",
    properties: {
      ip: { type: "string", description: "IPv4 address." },
    },
    required: ["ip"],
  },
  kind: "http",
  groups: ["infrastructure"],
  apiKeyEnv: "SHODAN_API_KEY",
  timeoutMs: 15_000,
  maxOutputBytes: 12_000,
  async execute(args) {
    const ip = String(args.ip ?? "").trim();
    if (!IP_RE.test(ip)) throw new Error("invalid IPv4");
    const key = process.env.SHODAN_API_KEY;
    if (!key) throw new Error("SHODAN_API_KEY not set in vault");
    const url = `https://api.shodan.io/shodan/host/${ip}?key=${encodeURIComponent(key)}&minify=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (res.status === 404) return { ip, found: false };
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`shodan HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ip,
      found: true,
      ports: data.ports,
      asn: data.asn,
      org: data.org,
      country_code: data.country_code,
      city: data.city,
      hostnames: data.hostnames,
      isp: data.isp,
      last_update: data.last_update,
      // Surface the most informative banners only  -  full data array
      // is often megabytes.
      bannerSnippets: ((data.data as Record<string, unknown>[]) ?? [])
        .slice(0, 8)
        .map((d) => ({
          port: d.port,
          product: d.product,
          version: d.version,
          transport: d.transport,
        })),
    };
  },
};
