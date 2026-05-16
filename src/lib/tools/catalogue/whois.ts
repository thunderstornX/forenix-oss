/**
 * HTTP: hackertarget WHOIS / DNS lookup.
 *
 * Free, no key, returns plaintext WHOIS + DNS records.
 * https://hackertarget.com/whois-lookup/
 */
import type { Tool } from "../types";

const HOST_RE = /^[a-z0-9.-]{3,253}$/i;

export const whoisTool: Tool = {
  name: "whois_dns",
  description:
    "Look up WHOIS registration + current DNS A/MX/NS records for " +
    "a domain or IP. Use for infrastructure recon to identify " +
    "registrar, registrant, name servers, mail servers.",
  parameters: {
    type: "object",
    properties: {
      target: { type: "string", description: "Domain or IPv4." },
    },
    required: ["target"],
  },
  kind: "http",
  groups: ["infrastructure"],
  timeoutMs: 15_000,
  maxOutputBytes: 8_000,
  async execute(args) {
    const target = String(args.target ?? "").trim();
    if (!HOST_RE.test(target)) throw new Error("invalid target");
    // Two parallel calls: whois + dns.
    const [whois, dns] = await Promise.all([
      fetch(`https://api.hackertarget.com/whois/?q=${encodeURIComponent(target)}`, {
        signal: AbortSignal.timeout(12_000),
      }).then((r) => r.text()).catch(() => "(whois unavailable)"),
      fetch(`https://api.hackertarget.com/dnslookup/?q=${encodeURIComponent(target)}`, {
        signal: AbortSignal.timeout(12_000),
      }).then((r) => r.text()).catch(() => "(dns unavailable)"),
    ]);
    return { target, whois: whois.slice(0, 4000), dns: dns.slice(0, 3000) };
  },
};
