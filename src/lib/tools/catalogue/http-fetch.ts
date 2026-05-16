/**
 * Builtin: HTTP GET with content extraction.
 *
 * Available to every agent group. Returns the response body
 * truncated to maxOutputBytes, plus a few headers + the final URL
 * after redirects.
 */
import type { Tool } from "../types";

export const httpFetchTool: Tool = {
  name: "http_fetch",
  description:
    "Fetch the body of a public URL via HTTPS. Returns the final URL " +
    "(after redirects), the HTTP status, content-type, and the body " +
    "(text, truncated). Use for fetching pages, JSON APIs, robots.txt, " +
    "sitemaps, security.txt, etc.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Absolute https:// URL." },
      method: { type: "string", enum: ["GET", "HEAD"], description: "Default GET." },
    },
    required: ["url"],
  },
  kind: "builtin",
  groups: ["identity", "infrastructure", "financial", "social", "geo", "relationships", "media"],
  timeoutMs: 15_000,
  maxOutputBytes: 12_000,
  async execute(args) {
    const url = String(args.url ?? "");
    const method = String(args.method ?? "GET");
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      throw new Error("URL must start with http(s)://");
    }
    const res = await fetch(url, {
      method,
      headers: { "user-agent": "forenix-oss/0.1 (OSINT analyst)" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") ?? "";
    const finalUrl = res.url;
    let body = "";
    if (method === "GET") {
      // Read the response, cap at 12KB.
      const reader = res.body?.getReader();
      if (reader) {
        const chunks: string[] = [];
        let total = 0;
        const dec = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const piece = dec.decode(value, { stream: true });
          chunks.push(piece);
          total += piece.length;
          if (total >= 12_000) {
            try { await reader.cancel(); } catch { /* ignore */ }
            break;
          }
        }
        body = chunks.join("");
      }
    }
    return { url: finalUrl, status: res.status, contentType: ct, body };
  },
};
