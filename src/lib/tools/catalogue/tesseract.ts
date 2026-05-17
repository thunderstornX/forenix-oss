/**
 * Subprocess: tesseract — OCR text extraction from an image URL.
 * https://github.com/tesseract-ocr/tesseract
 *
 * Install:  apt install tesseract-ocr
 * Usage:    tesseract <image> - -l eng
 */
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnTool } from "../runner";
import type { Tool } from "../types";

const URL_RE = /^https?:\/\/[A-Za-z0-9._\-/:%?#=&+~,]+$/;
const MAX_BYTES = 20 * 1024 * 1024;

export const tesseractTool: Tool = {
  name: "tesseract_ocr",
  description:
    "OCR an image URL with Tesseract and return the recognised text. " +
    "Use to extract written content from screenshot evidence (chat " +
    "logs, document scans, signage in geo investigations).",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Public URL of an image file." },
      lang: { type: "string", description: "Tesseract lang code (default 'eng')." },
    },
    required: ["url"],
  },
  kind: "subprocess",
  groups: ["media", "identity", "social"],
  timeoutMs: 45_000,
  maxOutputBytes: 16_000,
  async execute(args) {
    const url = String(args.url ?? "").trim();
    if (!URL_RE.test(url)) throw new Error("invalid url");
    const lang = /^[a-z]{3}(\+[a-z]{3})*$/.test(String(args.lang ?? "eng"))
      ? String(args.lang ?? "eng")
      : "eng";

    const dir = await mkdtemp(join(tmpdir(), "forenix-ocr-"));
    const path = join(dir, "image.bin");
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30_000);
      const res = await fetch(url, { signal: ctl.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) throw new Error(`file too large: ${ab.byteLength} bytes`);
      await writeFile(path, Buffer.from(ab));

      const { exitCode, stdout, stderr } = await spawnTool({
        cmd: "tesseract",
        argv: [path, "-", "-l", lang, "--psm", "3"],
        timeoutMs: 30_000,
        maxBytes: 200_000,
      });
      if (exitCode !== 0 && !stdout) {
        throw new Error(`tesseract exit ${exitCode}: ${stderr.slice(0, 200)}`);
      }
      const text = stdout.trim();
      return {
        url,
        lang,
        bytes: ab.byteLength,
        chars: text.length,
        text: text.slice(0, 12_000),
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};
