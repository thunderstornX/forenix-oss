/**
 * Subprocess: holehe — check which sites an email is registered on.
 * https://github.com/megadose/holehe
 *
 * Install:  pip install holehe
 * Usage:    holehe <email> --only-used --no-color
 */
import { spawnTool } from "../runner";
import type { Tool } from "../types";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export const holeheTool: Tool = {
  name: "holehe_email",
  description:
    "Check which online services an email address is registered on. " +
    "Returns a list of platforms where the email exists (without " +
    "revealing the password). Use for OSINT identity discovery.",
  parameters: {
    type: "object",
    properties: {
      email: { type: "string", description: "Email address to enumerate." },
    },
    required: ["email"],
  },
  kind: "subprocess",
  groups: ["identity", "social"],
  timeoutMs: 60_000,
  maxOutputBytes: 12_000,
  async execute(args) {
    const email = String(args.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error("invalid email format");
    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "holehe",
      argv: [email, "--only-used", "--no-color"],
      timeoutMs: 55_000,
      maxBytes: 100_000,
    });
    if (exitCode !== 0 && !stdout) {
      throw new Error(`holehe exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    const hits: string[] = [];
    for (const line of stdout.split("\n")) {
      const m = line.match(/^\[\+\]\s+(\S+)/);
      if (m) hits.push(m[1]!);
    }
    return { email, found: hits.length, services: hits };
  },
};
