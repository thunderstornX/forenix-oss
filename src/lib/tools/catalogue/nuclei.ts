/**
 * Subprocess: nuclei (ProjectDiscovery)  -  template-driven detection
 * for misconfigurations, exposures, and known vulns.
 * https://github.com/projectdiscovery/nuclei
 *
 * Install:  go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
 *           nuclei -update-templates  # one-time
 *
 * Safety: only the `exposures`, `misconfiguration`, and `technologies`
 * template families. No exploit families. Single-target only.
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const URL_RE = /^https?:\/\/[A-Za-z0-9._\-/:%?#=&+~,]+$/;

export const nucleiTool: Tool = {
  name: "nuclei_recon",
  description:
    "Run safe, recon-flavoured nuclei templates against a single URL: " +
    "exposures (open dirs, leaked configs), tech-stack fingerprinting, " +
    "and misconfiguration checks. Returns matched templates with " +
    "severity. Excludes any 'exploit' or 'cve' templates by default.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Single target URL." },
    },
    required: ["url"],
  },
  kind: "subprocess",
  groups: ["infrastructure"],
  timeoutMs: 120_000,
  maxOutputBytes: 32_000,
  async execute(args) {
    const url = String(args.url ?? "").trim();
    if (!URL_RE.test(url)) throw new Error("invalid url");
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "nuclei",
      argv: [
        "-u", url,
        "-jsonl",
        "-silent",
        "-no-color",
        "-rate-limit", "30",
        "-timeout", "10",
        // recon-only template families
        "-tags", "exposure,misconfig,tech,panel",
        "-exclude-tags", "cve,exploit,intrusive,fuzz,unauth",
        "-disable-update-check",
      ],
      timeoutMs: 110_000,
      maxBytes: 200_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`nuclei exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    const matches: Array<{
      template: string;
      severity: string;
      name: string;
      matchedAt: string;
    }> = [];
    for (const line of stdout.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("{")) continue;
      try {
        const j = JSON.parse(t);
        matches.push({
          template: j["template-id"] ?? j.templateID ?? "?",
          severity: j.info?.severity ?? "info",
          name: j.info?.name ?? "?",
          matchedAt: j["matched-at"] ?? j.host ?? url,
        });
      } catch { /* skip */ }
    }
    return { url, matches: matches.length, findings: matches.slice(0, 30) };
  },
};
