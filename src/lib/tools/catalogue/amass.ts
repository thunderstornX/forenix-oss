/**
 * Subprocess: amass  -  deep, slower subdomain enumeration with
 * historical Certificate Transparency + WHOIS pivots. Use as a
 * follow-up to subfinder when more recall is wanted.
 * https://github.com/owasp-amass/amass
 *
 * Install:  go install github.com/owasp-amass/amass/v4/cmd/amass@latest
 * Usage:    amass enum -d example.com -passive -silent -timeout 2
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const DOMAIN_RE = /^(?=.{1,253}$)([A-Za-z0-9_-]{1,63}\.)+[A-Za-z]{2,63}$/;

export const amassTool: Tool = {
  name: "amass_passive",
  description:
    "Deep, passive subdomain enumeration with historical Certificate " +
    "Transparency + open-source intel pivots. Slower than subfinder " +
    "but higher recall. Use when subfinder returns too few results " +
    "and the target is worth a deeper sweep.",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Apex domain (e.g. example.com)." },
    },
    required: ["domain"],
  },
  kind: "subprocess",
  groups: ["infrastructure"],
  timeoutMs: 150_000,
  maxOutputBytes: 32_000,
  async execute(args) {
    const domain = String(args.domain ?? "").trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw new Error("invalid domain");
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "amass",
      argv: ["enum", "-passive", "-d", domain, "-nocolor", "-silent", "-timeout", "2"],
      timeoutMs: 140_000,
      maxBytes: 300_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`amass exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    const subs = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.endsWith(domain))
      .slice(0, 250);
    return { domain, count: subs.length, subdomains: subs };
  },
};
