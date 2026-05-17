/**
 * Subprocess: exiftool — extract metadata from an image URL.
 * https://exiftool.org
 *
 * Use case: download an image referenced in an investigation,
 * extract every metadata tag (GPS, camera model, software, etc.)
 * Returns the parsed JSON exiftool emits with -json.
 *
 * Safety: file is fetched to /tmp, scanned, then deleted. Capped at 25 MB.
 */
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnTool } from "../runner";
import type { Tool } from "../types";

const URL_RE = /^https?:\/\/[A-Za-z0-9._\-/:%?#=&+~,]+$/;
const MAX_BYTES = 25 * 1024 * 1024;

export const exiftoolTool: Tool = {
  name: "exiftool_url",
  description:
    "Extract image metadata from a remote URL: EXIF, IPTC, XMP, " +
    "GPS coordinates, camera model, software, original timestamps. " +
    "Use for geo investigations (GPS lat/long) and identity " +
    "(software fingerprints, original camera serial).",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Public URL of an image file." },
    },
    required: ["url"],
  },
  kind: "subprocess",
  groups: ["geo", "identity", "media"],
  timeoutMs: 45_000,
  maxOutputBytes: 16_000,
  async execute(args) {
    const url = String(args.url ?? "").trim();
    if (!URL_RE.test(url)) throw new Error("invalid url");

    const dir = await mkdtemp(join(tmpdir(), "forenix-exif-"));
    const path = join(dir, "image.bin");
    try {
      // Fetch with size cap.
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30_000);
      const res = await fetch(url, { signal: ctl.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) throw new Error(`file too large: ${ab.byteLength} bytes`);
      await writeFile(path, Buffer.from(ab));

      const { exitCode, stdout, stderr } = await spawnTool({
        cmd: "exiftool",
        argv: ["-json", "-G", "-n", path],
        timeoutMs: 15_000,
        maxBytes: 200_000,
      });
      if (exitCode !== 0 && !stdout) {
        throw new Error(`exiftool exit ${exitCode}: ${stderr.slice(0, 200)}`);
      }
      let parsed: unknown[] = [];
      try { parsed = JSON.parse(stdout); } catch { /* keep empty */ }
      const meta = (Array.isArray(parsed) ? parsed[0] : {}) as Record<string, unknown>;
      // Strip noisy keys + the SourceFile path (tmpdir leak).
      for (const k of ["SourceFile", "ExifTool:ExifToolVersion", "File:Directory"]) delete meta[k];
      return {
        url,
        bytes: ab.byteLength,
        keys: Object.keys(meta).length,
        metadata: meta,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};
