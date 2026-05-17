/**
 * Subprocess: httpx (ProjectDiscovery)  -  fast HTTP probe over a
 * list of hosts. Returns status code, title, tech-stack, content-
 * length, redirect chain. Pairs perfectly with subfinder.
 * https://github.com/projectdiscovery/httpx
 *
 * Install:  go install github.com/projectdiscovery/httpx/cmd/httpx@latest
 * Usage:    echo "host1\nhost2" | httpx -json -silent
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const DOMAIN_RE = /^[A-Za-z0-9._-]{1,253}$/;

export const httpxTool: Tool = {
  name: "httpx_probe",
  description:
    "Probe up to 50 hosts for live HTTP services. Returns status, " +
    "title, server header, content-length, and detected technology " +
    "stack. Use after subfinder to triage which subdomains host " +
    "live services worth investigating.",
  parameters: {
    type: "object",
    properties: {
      hosts: {
        type: "array",
        description: "Up to 50 hostnames or URLs to probe.",
        items: { type: "string" },
      },
    },
    required: ["hosts"],
  },
  kind: "subprocess",
  groups: ["infrastructure"],
  timeoutMs: 90_000,
  maxOutputBytes: 32_000,
  async execute(args) {
    const hostsRaw = Array.isArray(args.hosts) ? args.hosts : [];
    const hosts: string[] = hostsRaw
      .map((h) => String(h).trim().toLowerCase())
      .filter((h) => h && DOMAIN_RE.test(h))
      .slice(0, 50);
    if (hosts.length === 0) throw new Error("no valid hosts provided");

    const input = hosts.join("\n");
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "sh",
      argv: [
        "-c",
        `echo "${input.replace(/"/g, "")}" | httpx -silent -json -timeout 10 -title -tech-detect -status-code -content-length -no-color`,
      ],
      timeoutMs: 80_000,
      maxBytes: 400_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`httpx exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    const probes: Array<Record<string, unknown>> = [];
    for (const line of stdout.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("{")) continue;
      try {
        const j = JSON.parse(t);
        probes.push({
          input: j.input ?? j.host,
          url: j.url,
          status: j.status_code,
          title: j.title,
          tech: j.tech ?? j.technologies,
          length: j.content_length,
          server: j.webserver ?? j.server,
        });
      } catch { /* skip malformed lines */ }
    }
    return { probed: hosts.length, alive: probes.length, results: probes };
  },
};
