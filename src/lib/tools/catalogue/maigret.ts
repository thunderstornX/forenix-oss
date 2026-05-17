/**
 * Subprocess: maigret — sherlock+++. Searches 3000+ sites for a
 * username, classifies hits, and provides extra metadata when
 * available. https://github.com/soxoj/maigret
 *
 * Install:  pip install maigret
 * Usage:    maigret <username> --json simple --no-color
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const USERNAME_RE = /^[A-Za-z0-9_\-.]{2,40}$/;

export const maigretTool: Tool = {
  name: "maigret_username",
  description:
    "Higher-recall username recon (3000+ sites vs sherlock's 400). " +
    "Use as the primary identity-discovery tool. Returns platforms " +
    "where an account with the given handle appears to exist, with " +
    "URLs and per-site confidence.",
  parameters: {
    type: "object",
    properties: {
      username: { type: "string", description: "The handle to search for." },
      top_sites: {
        type: "number",
        description: "Limit to top-N most reliable sites (default 100 for speed).",
      },
    },
    required: ["username"],
  },
  kind: "subprocess",
  groups: ["identity", "social"],
  timeoutMs: 120_000,
  maxOutputBytes: 32_000,
  async execute(args) {
    const username = String(args.username ?? "").trim();
    if (!USERNAME_RE.test(username)) {
      throw new Error("invalid username (alpha-num + _.- only, 2-40 chars)");
    }
    const top = Math.min(Math.max(Number(args.top_sites ?? 100), 20), 500);
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "maigret",
      argv: [
        username,
        "--top-sites", String(top),
        "--no-color",
        "--no-progressbar",
        "--retries", "1",
        "--timeout", "8",
      ],
      timeoutMs: 110_000,
      maxBytes: 300_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`maigret exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    // maigret prints human-readable lines like "[+] GitHub: https://github.com/foo"
    const hits: Array<{ platform: string; url: string }> = [];
    for (const line of stdout.split("\n")) {
      const m = line.match(/^\[\+\]\s+(.+?):\s+(https?:\/\/\S+)/);
      if (m) hits.push({ platform: m[1]!.trim(), url: m[2]! });
    }
    return { username, sitesQueried: top, found: hits.length, hits: hits.slice(0, 80) };
  },
};
