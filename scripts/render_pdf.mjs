/**
 * Generic markdown → A4 PDF renderer.
 *
 * Usage:
 *   bun run scripts/render_pdf.mjs <source.md> <out.pdf> "<Title>" "<Subtitle>"
 *
 * Pipeline:  markdown → marked → styled HTML → playwright print-to-PDF
 *
 * Re-writes `manual_screenshots/...` and `screenshots/...` image
 * paths to absolute file:// URLs so playwright loads them off disk.
 */
import { chromium } from "playwright";
import { marked } from "marked";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const [, , src, out, title, subtitle] = process.argv;
if (!src || !out) {
  console.error("usage: render_pdf.mjs <src.md> <out.pdf> [title] [subtitle]");
  process.exit(2);
}
const SRC   = resolve(src);
const OUT   = resolve(out);
const HTML  = OUT.replace(/\.pdf$/i, ".html");
const TITLE = title ?? "forenix-oss";
const SUB   = subtitle ?? "";

const md = await readFile(SRC, "utf-8");

const mdAbs = md
  .replace(/\(manual_screenshots\/([^)]+)\)/g,
    (_, f) => `(file://${join(ROOT, "docs", "manual_screenshots", f)})`)
  .replace(/\(screenshots\/([^)]+)\)/g,
    (_, f) => `(file://${join(ROOT, "docs", "screenshots", f)})`);

const inner = marked.parse(mdAbs, { gfm: true, breaks: false });

const css = `
@page { size: A4; margin: 22mm 18mm 22mm 18mm; }

:root {
  --bg: #ffffff;
  --fg: #0c1117;
  --muted: #5b6473;
  --accent: #0e6e63;
  --accent-soft: #d6ece8;
  --border: #d8dee9;
  --hr: #e5ebef;
  --code-bg: #f3f5f7;
  --code-fg: #1d2530;
}

html, body { background: var(--bg); color: var(--fg); margin: 0; padding: 0; }
body {
  font-family: "Inter", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.cover {
  page-break-after: always;
  padding: 6mm 0 0 0;
  border-bottom: 1px solid var(--hr);
}
.cover .eyebrow {
  color: var(--accent); font-size: 10pt;
  letter-spacing: 0.22em; text-transform: uppercase;
  font-weight: 600;
}
.cover h1.title {
  font-size: 40pt; font-weight: 800;
  margin: 8pt 0 6pt 0; line-height: 1.05;
}
.cover .subtitle {
  font-size: 14pt; color: var(--muted); margin-bottom: 28pt;
}
.cover .meta {
  font-size: 10pt; color: var(--muted);
  border-top: 1px solid var(--hr); padding-top: 8pt;
}

.content { padding-top: 6mm; }

h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid-page; }
h1 {
  font-size: 22pt; font-weight: 800;
  margin-top: 16pt; margin-bottom: 6pt;
  border-bottom: 1px solid var(--hr); padding-bottom: 4pt;
}
h2 {
  font-size: 15pt; font-weight: 700;
  margin-top: 14pt; margin-bottom: 4pt;
}
h3 {
  font-size: 12pt; font-weight: 700;
  margin-top: 10pt; margin-bottom: 2pt;
  color: var(--accent);
}
h4 {
  font-size: 11pt; font-weight: 700;
  margin-top: 8pt; margin-bottom: 2pt;
  color: var(--muted);
}
p { margin: 4pt 0 6pt 0; }
ul, ol { margin: 4pt 0 6pt 0; padding-left: 18pt; }
li { margin: 2pt 0; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

code {
  font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
  font-size: 9pt;
  background: var(--code-bg); color: var(--code-fg);
  padding: 1pt 4pt; border-radius: 3pt;
}
pre {
  background: var(--code-bg);
  border: 1px solid var(--border); border-left: 3px solid var(--accent);
  border-radius: 4pt; padding: 8pt 10pt;
  font-size: 9pt; line-height: 1.45;
  overflow-x: auto; page-break-inside: avoid;
}
pre code { background: transparent; padding: 0; }

table {
  border-collapse: collapse; margin: 6pt 0 10pt 0;
  font-size: 9.5pt; width: 100%;
  page-break-inside: avoid;
}
th, td {
  text-align: left; vertical-align: top;
  border: 1px solid var(--border); padding: 4pt 6pt;
}
th { background: var(--code-bg); font-weight: 700; }

img {
  max-width: 100%; height: auto;
  border: 1px solid var(--border); border-radius: 4pt;
  margin: 8pt 0; page-break-inside: avoid; display: block;
}

hr { border: 0; border-top: 1px solid var(--hr); margin: 14pt 0; }

blockquote {
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  margin: 8pt 0; padding: 6pt 10pt;
  color: var(--code-fg); border-radius: 3pt;
}

strong { font-weight: 700; }
em { font-style: italic; }

td > p:first-child { margin-top: 0; }
td > p:last-child { margin-bottom: 0; }

h2 + p, h3 + p, h4 + p { page-break-before: avoid; }
`;

const cover = `
<section class="cover">
  <div class="eyebrow">${TITLE} | v0.1 | 2026-05</div>
  <h1 class="title">${TITLE}</h1>
  <div class="subtitle">${SUB}</div>
  <div class="meta">
    <b>Author:</b> Ali Murtaza Bhutto &nbsp;|&nbsp;
    <b>Repository:</b> github.com/thunderstornX/forenix-oss &nbsp;|&nbsp;
    <b>License:</b> MIT
  </div>
</section>
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${TITLE}</title>
<style>${css}</style>
</head>
<body>
${cover}
<main class="content">
${inner}
</main>
</body>
</html>`;

await writeFile(HTML, html);
console.log("wrote HTML:", HTML);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + HTML, { waitUntil: "networkidle" });
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "22mm", bottom: "22mm", left: "18mm", right: "18mm" },
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="width:100%;padding:0 18mm;font-size:8pt;color:#5b6473;display:flex;justify-content:space-between;">
      <span>forenix-oss | ${basename(SRC, ".md")}</span>
      <span>v0.1 | 2026-05</span>
    </div>`,
  footerTemplate: `
    <div style="width:100%;padding:0 18mm;font-size:8pt;color:#5b6473;display:flex;justify-content:space-between;">
      <span>github.com/thunderstornX/forenix-oss</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
});
await browser.close();
console.log("wrote PDF:", OUT);
