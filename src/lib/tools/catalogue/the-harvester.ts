/**
 * Subprocess: theHarvester — passive recon for emails, subdomains,
 * hosts, and metadata. https://github.com/laramies/theHarvester
 *
 * Install:  pipx install theHarvester
 * Usage:    theHarvester -d <domain> -b <source> -f json -o <file>
 *
 * For tool-use we read the JSON output back from /tmp.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnTool } from "../runner";
import type { Tool } from "../types";

const DOMAIN_RE = /^[a-z0-9.-]{3,253}$/i;

export const theHarvesterTool: Tool = {
  name: "the_harvester",
  description:
    "Run theHarvester to gather emails, subdomains, and hosts for a " +
    "domain from public sources (crtsh, anubis, hackertarget, " +
    "duckduckgo, …). Use for infrastructure + identity recon.",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "The target domain." },
      sources: {
        type: "string",
        description:
          "Comma-separated sources. Default: crtsh,hackertarget,anubis,duckduckgo.",
      },
    },
    required: ["domain"],
  },
  kind: "subprocess",
  groups: ["infrastructure", "identity"],
  timeoutMs: 90_000,
  maxOutputBytes: 24_000,
  async execute(args) {
    const domain = String(args.domain ?? "").trim().toLowerCase();
    const sources = String(args.sources ?? "crtsh,hackertarget,anubis,duckduckgo");
    if (!DOMAIN_RE.test(domain)) throw new Error("invalid domain");

    const dir = await mkdtemp(join(tmpdir(), "harvester-"));
    const out = join(dir, "out.json");
    try {
      await spawnTool({
        cmd: "theHarvester",
        argv: ["-d", domain, "-b", sources, "-f", out],
        timeoutMs: 80_000,
        maxBytes: 1024 * 1024,
      });
      const raw = await readFile(out, "utf-8").catch(() => "{}");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        domain,
        sources: sources.split(",").map((s) => s.trim()),
        // Surface the headline arrays only — full JSON is too noisy.
        emails: (parsed.emails as string[]) ?? [],
        hosts: (parsed.hosts as string[]) ?? [],
        subdomains: (parsed.subdomains as string[]) ?? [],
        ips: (parsed.ips as string[]) ?? [],
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};
