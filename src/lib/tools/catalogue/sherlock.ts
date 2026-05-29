/**
 * Subprocess: sherlock  -  find a username across 400+ social
 * networks. https://github.com/sherlock-project/sherlock
 *
 * Install:  pip install sherlock-project
 * Usage:    sherlock <username> --print-found --no-color --json -
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

// Must START with an alphanumeric or underscore: the handle is passed
// as a positional argv to sherlock, so a leading "-" could otherwise be
// parsed as a CLI flag. Real handles never start with a dash/dot.
const USERNAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_\-.]{1,39}$/;

export const sherlockTool: Tool = {
  name: "sherlock_username",
  description:
    "Search 400+ social networks for the given username. Returns " +
    "the platforms where an account with that handle was found, " +
    "with their URLs. Use for OSINT identity / social discovery.",
  parameters: {
    type: "object",
    properties: {
      username: { type: "string", description: "The handle to search for." },
    },
    required: ["username"],
  },
  kind: "subprocess",
  groups: ["identity", "social"],
  timeoutMs: 60_000,
  maxOutputBytes: 16_000,
  async execute(args) {
    const username = String(args.username ?? "").trim();
    if (!USERNAME_RE.test(username)) {
      throw new Error("invalid username (alpha-num + _.- only, 2-40 chars)");
    }
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "sherlock",
      argv: [username, "--print-found", "--no-color", "--timeout", "10"],
      timeoutMs: 55_000,
      maxBytes: 200_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`sherlock exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    // Parse the human-readable output: "[+] Reddit: https://www.reddit.com/user/foo"
    const hits: Array<{ platform: string; url: string }> = [];
    for (const line of stdout.split("\n")) {
      const m = line.match(/^\[\+\]\s+(.+?):\s+(https?:\/\/\S+)/);
      if (m) hits.push({ platform: m[1]!, url: m[2]! });
    }
    return { username, found: hits.length, hits };
  },
};
