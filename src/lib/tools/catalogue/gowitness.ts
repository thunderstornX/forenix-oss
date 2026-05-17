/**
 * Subprocess: gowitness — automated webpage screenshot capture.
 * Used as evidence acquisition: snapshot a URL, return the path
 * (relative to /tmp) and the metadata. Operators / the forensic
 * agent can promote a screenshot to evidence.
 * https://github.com/sensepost/gowitness
 *
 * Install:  go install github.com/sensepost/gowitness@latest
 *           apt install chromium-browser
 * Usage:    gowitness single -u <url> --output /tmp/dir
 */
import { mkdtemp, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnTool } from "../runner";
import type { Tool } from "../types";

const URL_RE = /^https?:\/\/[A-Za-z0-9._\-/:%?#=&+~,]+$/;

export const gowitnessTool: Tool = {
  name: "gowitness_capture",
  description:
    "Capture a screenshot of a webpage using a headless Chromium. " +
    "Returns the local file path + size. Use for forensic evidence " +
    "acquisition: lock down what a page looked like at a moment in " +
    "time, hash it later.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Public URL to screenshot." },
    },
    required: ["url"],
  },
  kind: "subprocess",
  groups: ["social", "media", "infrastructure"],
  timeoutMs: 60_000,
  maxOutputBytes: 8_000,
  async execute(args) {
    const url = String(args.url ?? "").trim();
    if (!URL_RE.test(url)) throw new Error("invalid url");
    const dir = await mkdtemp(join(tmpdir(), "forenix-shot-"));

    const { exitCode, stdout, stderr } = await spawnTool({
      cmd: "gowitness",
      argv: [
        "scan",
        "single",
        "-u", url,
        "--screenshot-path", dir,
        "--timeout", "20",
        "--write-none",
      ],
      timeoutMs: 50_000,
      maxBytes: 200_000,
    });
    // gowitness sometimes exits 0 even on partial failures; check files.
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".png") || f.endsWith(".jpeg"));
    } catch { /* empty */ }
    if (files.length === 0 && exitCode !== 0) {
      throw new Error(`gowitness exit ${exitCode}: ${stderr.slice(0, 200) || stdout.slice(0, 200)}`);
    }

    const out = await Promise.all(
      files.slice(0, 4).map(async (f) => {
        const full = join(dir, f);
        const s = await stat(full).catch(() => null);
        return {
          path: full,
          filename: f,
          bytes: s?.size ?? 0,
        };
      }),
    );
    return { url, captured: out.length, screenshots: out };
  },
};
