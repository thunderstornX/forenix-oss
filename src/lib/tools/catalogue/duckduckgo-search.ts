/**
 * Builtin: DuckDuckGo HTML search.
 *
 * No API key. Scrapes the lightweight HTML result page, returns the
 * top N results as {title, url, snippet}. Use as the everyday
 * "google for the analyst" tool.
 *
 * Caveat: DDG occasionally rate-limits; on failure we return an
 * empty list rather than throwing, so the LLM can fall back to
 * other tools.
 */
import type { Tool } from "../types";

const DDG_URL = "https://html.duckduckgo.com/html/";

export const duckDuckGoSearchTool: Tool = {
  name: "web_search",
  description:
    "Search the public web for the given query. Returns up to 10 " +
    "results (title, URL, snippet). Use to find candidate sources " +
    "BEFORE invoking specific OSINT tools.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Plain-text search query." },
      limit: { type: "number", description: "Max results, 1..10. Default 8." },
    },
    required: ["query"],
  },
  kind: "builtin",
  groups: ["identity", "infrastructure", "financial", "social", "geo", "relationships", "media"],
  timeoutMs: 15_000,
  maxOutputBytes: 8_000,
  async execute(args) {
    const query = String(args.query ?? "").trim();
    const limit = Math.max(1, Math.min(10, Number(args.limit ?? 8)));
    if (!query) return { results: [] };

    const form = new URLSearchParams({ q: query, kl: "wt-wt" });
    let html: string;
    try {
      const res = await fetch(DDG_URL, {
        method: "POST",
        headers: {
          "user-agent": "Mozilla/5.0 forenix-oss/0.1",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return { results: [], error: `ddg HTTP ${res.status}` };
      html = await res.text();
    } catch (err) {
      return { results: [], error: (err as Error).message };
    }

    // Cheap parse: the result-block has a class "result__a" anchor,
    // a "result__snippet" div. We don't want to ship a full DOM
    // parser to the server  -  regex is enough for this fixed shape.
    const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snipRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const links: Array<{ url: string; title: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) && links.length < limit) {
      const rawUrl = m[1]!;
      const title = stripTags(m[2]!);
      const url = unwrapDdgRedirect(rawUrl);
      links.push({ url, title });
    }
    const snippets: string[] = [];
    while ((m = snipRe.exec(html)) && snippets.length < limit) {
      snippets.push(stripTags(m[1]!));
    }
    const results = links.map((l, i) => ({
      title: l.title,
      url: l.url,
      snippet: snippets[i] ?? "",
    }));
    return { query, results };
  },
};

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function unwrapDdgRedirect(url: string): string {
  // DDG wraps targets in /l/?uddg=<encoded>. Unwrap if present.
  try {
    const u = new URL(url, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return u.toString();
  } catch {
    return url;
  }
}
