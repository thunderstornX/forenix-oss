/**
 * Subprocess: dnsx (ProjectDiscovery)  -  DNS toolkit. Resolves A,
 * AAAA, MX, NS, TXT, CNAME, SOA records in one pass.
 * https://github.com/projectdiscovery/dnsx
 *
 * Install:  go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const DOMAIN_RE = /^(?=.{1,253}$)([A-Za-z0-9_-]{1,63}\.)+[A-Za-z]{2,63}$/;
const VALID_RECORDS = new Set(["a", "aaaa", "mx", "ns", "txt", "cname", "soa", "ptr", "caa", "srv"]);

export const dnsxTool: Tool = {
  name: "dnsx_records",
  description:
    "Look up DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA) for a " +
    "domain in a single pass. Use to surface mail provider, " +
    "name-server pivots, and verification TXT records.",
  parameters: {
    type: "object",
    properties: {
      domain: { type: "string", description: "Hostname to query." },
      records: {
        type: "array",
        description: "Record types to query (default: a, mx, ns, txt).",
        items: { type: "string" },
      },
    },
    required: ["domain"],
  },
  kind: "subprocess",
  groups: ["infrastructure"],
  timeoutMs: 30_000,
  maxOutputBytes: 16_000,
  async execute(args) {
    const domain = String(args.domain ?? "").trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) throw new Error("invalid domain");
    const want = Array.isArray(args.records)
      ? args.records.map((r) => String(r).toLowerCase()).filter((r) => VALID_RECORDS.has(r))
      : ["a", "mx", "ns", "txt"];
    if (want.length === 0) want.push("a");

    const argv = ["-silent", "-resp", "-no-color", "-j"];
    for (const r of want) argv.push(`-${r}`);

    // dnsx reads targets from stdin. Feed the (regex-validated) domain
    // in directly rather than via a `sh -c 'echo … | dnsx'` pipe —
    // no shell, no string interpolation, nothing to inject into even
    // if the validator above were ever loosened.
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "dnsx",
      argv,
      input: `${domain}\n`,
      timeoutMs: 25_000,
      maxBytes: 100_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`dnsx exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    const records: Record<string, string[]> = {};
    for (const line of stdout.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("{")) continue;
      try {
        const j = JSON.parse(t) as Record<string, unknown>;
        for (const r of want) {
          const key = r;
          const arr = j[key];
          if (Array.isArray(arr)) {
            (records[key] ??= []).push(...(arr as string[]));
          }
        }
      } catch { /* skip */ }
    }
    // dedupe each list
    for (const k of Object.keys(records)) {
      records[k] = Array.from(new Set(records[k])).slice(0, 30);
    }
    return { domain, records };
  },
};
