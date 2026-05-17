/**
 * Subprocess: subfinder (ProjectDiscovery)  -  passive subdomain
 * enumeration across 30+ free sources (Wayback, CRT, AlienVault, ...).
 * Fast and quiet (no DNS queries against the target).
 * https://github.com/projectdiscovery/subfinder
 *
 * Install:  go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
 * Usage:    subfinder -d example.com -silent
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const DOMAIN_RE = /^(?=.{1,253}$)([A-Za-z0-9_-]{1,63}\.)+[A-Za-z]{2,63}$/;

export const subfinderTool: Tool = {
  name: "subfinder_domain",
  description:
    "Passively enumerate subdomains for a registered domain via 30+ " +
    "open-source intelligence sources (CRT.sh, Wayback, AlienVault, " +
    "etc.). No DNS queries against the target. Use as the primary " +
    "infrastructure-discovery tool.",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Apex domain (e.g. example.com)." },
    },
    required: ["domain"],
  },
  kind: "subprocess",
  groups: ["infrastructure"],
  timeoutMs: 90_000,
  maxOutputBytes: 32_000,
  async execute(args) {
    const domain = String(args.domain ?? "").trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw new Error("invalid domain");
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "subfinder",
      argv: ["-d", domain, "-silent", "-timeout", "20", "-max-time", "60"],
      timeoutMs: 80_000,
      maxBytes: 200_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`subfinder exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    const subs = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.endsWith(domain))
      .slice(0, 200);
    return { domain, count: subs.length, subdomains: subs };
  },
};
