/**
 * Capture screenshots of every forenix-oss view.
 *
 * Prerequisites:
 *   - dev server running on http://localhost:3737
 *   - database seeded
 *
 * Writes 1440x900 PNGs into docs/screenshots/.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "docs", "screenshots");
const HOST = process.env.HOST ?? "http://localhost:3737";

await mkdir(OUT, { recursive: true });

const VIEWS = [
  // Primary nav
  { view: "dashboard",      file: "01-dashboard.png" },
  { view: "investigations", file: "02-investigations.png" },
  { view: "pipeline",       file: "03-pipeline.png" },
  { view: "cases",          file: "04-cases.png" },
  { view: "evidence",       file: "05-evidence.png" },
  { view: "branch-graph",   file: "06-branch-graph.png" },
  { view: "entity-graph",   file: "07-entity-graph.png" },
  { view: "network-graph",  file: "08-network-graph.png" },
  { view: "monitors",       file: "09-monitors.png" },
  { view: "verification",   file: "10-verification.png" },
  { view: "ai-lab",         file: "11-ai-lab.png" },
  { view: "reports",        file: "12-reports.png" },
  { view: "audit",          file: "13-audit.png" },
  { view: "integrity",      file: "14-integrity.png" },
  { view: "reviews",        file: "15-reviews.png" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

async function shoot(page, file, settle = 900) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(settle);
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: false });
  console.log("  →", file);
}

// ── Resolve the seeded ids so we can deep-link into a detail panel.
const probe = await ctx.newPage();
await probe.goto(`${HOST}/api/investigations`);
const invs = JSON.parse(await probe.locator("body").innerText());
const inv = invs.data.find((i) => i.title.startsWith("INV-2025-019")) ?? invs.data[0];
await probe.goto(`${HOST}/api/cases`);
const cases = JSON.parse(await probe.locator("body").innerText());
const c = cases.data[0];
await probe.close();

console.log(`investigation: ${inv.title} (${inv.id})`);
console.log(`case:          ${c.title} (${c.caseNumber} / ${c.id})`);
console.log();

// ── Walk through every view.
const page = await ctx.newPage();
for (const { view, file } of VIEWS) {
  console.log(`[capture] ${view}`);
  await page.goto(`${HOST}/?view=${view}`, { waitUntil: "domcontentloaded" });
  await shoot(page, file);
}

// ── Detail panels.
console.log("[capture] investigation detail");
await page.goto(`${HOST}/?view=investigations&inv=${inv.id}`, { waitUntil: "domcontentloaded" });
await shoot(page, "16-investigation-detail.png", 1200);

console.log("[capture] case detail");
await page.goto(`${HOST}/?view=cases&case=${c.id}`, { waitUntil: "domcontentloaded" });
await shoot(page, "17-case-detail.png", 1200);

console.log("[capture] command palette");
await page.goto(`${HOST}/?view=dashboard&palette=1`, { waitUntil: "domcontentloaded" });
await shoot(page, "18-command-palette.png");

console.log("[capture] sidebar collapsed");
await page.goto(`${HOST}/?view=dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.click('button:has-text("Collapse")');
await shoot(page, "19-sidebar-collapsed.png");

await browser.close();
console.log("\ndone →", OUT);
