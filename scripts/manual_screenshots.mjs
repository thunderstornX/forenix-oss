/**
 * Manual-grade screenshot driver.
 *
 * Walks through every workflow at 1440x900@2x and produces ~40
 * frames into docs/manual_screenshots/.  Used as inline figures
 * in docs/USER_MANUAL.md / USER_MANUAL.pdf.
 *
 * Prerequisites:
 *   - dev server on http://localhost:3737 (or HOST=)
 *   - database freshly seeded AND a live NVIDIA pipeline run + bridge
 *     so the demo state has real model output.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "docs", "manual_screenshots");
const HOST = process.env.HOST ?? "http://localhost:3737";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

// Sign in as the seeded admin so every authenticated route is reachable.
async function signIn() {
  const page = await ctx.newPage();
  await page.goto(`${HOST}/sign-in`);
  await page.locator('input[type="email"]').fill("admin@forenix-oss.local");
  await page.locator('input[type="password"]').fill("forenix");
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("/sign-in"), { timeout: 15_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.close();
}
await signIn();

async function shoot(page, file, settle = 1100) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(settle);
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: false });
  console.log("  ->", file);
}

async function shootFull(page, file, settle = 1100) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(settle);
  const path = join(OUT, file);
  await page.screenshot({ path, fullPage: true });
  console.log("  -> (full)", file);
}

// Helper for selectors that need an ID first.
const probe = await ctx.newPage();
await probe.goto(`${HOST}/api/investigations`);
const invs = JSON.parse(await probe.locator("body").innerText());
const invNorthwind = invs.data.find((i) => i.title.startsWith("INV-2025-019"));
const invMira = invs.data.find((i) => i.title.startsWith("INV-2025-020"));
await probe.goto(`${HOST}/api/cases`);
const cases = JSON.parse(await probe.locator("body").innerText());
const caseSandstone = cases.data.find((c) => c.caseNumber === "CASE-2025-007") ?? cases.data[0];
const caseBridged = cases.data.find((c) => c.caseNumber === "CASE-2026-002");
await probe.goto(`${HOST}/api/reports`);
const reports = JSON.parse(await probe.locator("body").innerText());
const reportWithSections = reports.data.find((r) => r.investigation && (r.findingCount ?? 0) > 0) ?? reports.data[0];
await probe.close();

const idx = {
  invNorthwind: invNorthwind.id,
  invMira: invMira.id,
  caseSandstone: caseSandstone.id,
  caseBridged: caseBridged ? caseBridged.id : caseSandstone.id,
  reportId: reportWithSections.id,
};
console.log("ids:", idx);
console.log();

// Persist the picked ids so the manual renderer can quote them.
await writeFile(join(OUT, "manifest.json"), JSON.stringify(idx, null, 2));

const page = await ctx.newPage();

const SHOTS = [
  // 1. Landing + tour
  ["00-landing-dashboard.png",    `${HOST}/?view=dashboard`],
  ["01-sidebar-tour.png",         `${HOST}/?view=dashboard`],
  ["02-topbar-status.png",        `${HOST}/?view=dashboard`],

  // 2. Investigations list + new investigation flow
  ["10-investigations-list.png",  `${HOST}/?view=investigations`],

  // 3. Investigation detail  -  Northwind (already complete, has linked case)
  ["20-investigation-detail.png", `${HOST}/?view=investigations&inv=${idx.invNorthwind}`],
  ["21-investigation-bridge-chip.png", `${HOST}/?view=investigations&inv=${idx.invNorthwind}`],

  // 4. Pipeline view (empty, ready to run)
  ["30-pipeline-empty.png",       `${HOST}/?view=pipeline`],

  // 5. Cases list + open case
  ["40-cases-list.png",           `${HOST}/?view=cases`],
  ["41-case-detail.png",          `${HOST}/?view=cases&case=${idx.caseBridged}`],

  // 6. Evidence (with sealed + collected items)
  ["50-evidence-list.png",        `${HOST}/?view=evidence`],

  // 7. Branch graph
  ["60-branch-graph.png",         `${HOST}/?view=branch-graph&case=${idx.caseBridged}`],

  // 8. Entity graph
  ["70-entity-graph.png",         `${HOST}/?view=entity-graph`],

  // 9. Network graph
  ["80-network-graph.png",        `${HOST}/?view=network-graph`],

  // 10. Monitors
  ["90-monitors.png",             `${HOST}/?view=monitors`],

  // 11. Verification
  ["100-verification.png",        `${HOST}/?view=verification`],

  // 12. AI Lab
  ["110-ai-lab.png",              `${HOST}/?view=ai-lab`],

  // 13. Reports list + detail
  ["120-reports-list.png",        `${HOST}/?view=reports`],

  // 14. Audit + Integrity
  ["140-audit-log.png",           `${HOST}/?view=audit`],
  ["141-integrity-dashboard.png", `${HOST}/?view=integrity`],

  // 15. Reviews
  ["150-reviews.png",             `${HOST}/?view=reviews`],

  // 16. Command palette
  ["160-command-palette.png",     `${HOST}/?view=dashboard&palette=1`],
];

for (const [file, url] of SHOTS) {
  console.log("[shoot]", file);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await shoot(page, file);
}

// 17. Click the "Verify chain" button on Integrity to capture the
//     post-verify state with the green panel.
console.log("[shoot] 142-integrity-verified.png (click + capture)");
await page.goto(`${HOST}/?view=integrity`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.locator('button:has-text("Verify chain")').first().click().catch(() => {});
await shoot(page, "142-integrity-verified.png", 1500);

// 18. Hover over a finding row to show the action buttons (verify / promote)
console.log("[shoot] 22-finding-actions.png (focus on actions row)");
await page.goto(`${HOST}/?view=investigations&inv=${idx.invMira}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.evaluate(() => window.scrollTo(0, 600));
await shoot(page, "22-finding-actions.png", 800);

// 19. Full-page scroll of a case detail so the long evidence section is captured
console.log("[shoot] 42-case-detail-full.png (full page)");
await page.goto(`${HOST}/?view=cases&case=${idx.caseBridged}`, { waitUntil: "domcontentloaded" });
await shootFull(page, "42-case-detail-full.png", 1500);

// 20. Sidebar collapsed state
console.log("[shoot] 03-sidebar-collapsed.png");
await page.goto(`${HOST}/?view=dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.locator('button:has-text("Collapse")').first().click().catch(() => {});
await shoot(page, "03-sidebar-collapsed.png", 800);

// 21. Pipeline configure -> fill in form -> before-Run
console.log("[shoot] 31-pipeline-configured.png");
await page.goto(`${HOST}/?view=pipeline`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
// Click on the row for INV-2025-019 so the dropdown is set
await page.locator(`text=INV-2025-019`).first().click().catch(() => {});
await shoot(page, "31-pipeline-configured.png", 700);

// 22. Filter input in action on Cases
console.log("[shoot] 43-cases-filter.png");
await page.goto(`${HOST}/?view=cases`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const filterInput = page.locator('input[placeholder="Filter..."]').first();
if (await filterInput.count()) {
  await filterInput.fill("sandstone");
  await page.waitForTimeout(400);
  await shoot(page, "43-cases-filter.png");
}

// 23. Reports detail (drilldown)
console.log("[shoot] 121-report-detail.png");
await page.goto(`${HOST}/?view=reports`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
// click the first "Open" button on a report card
await page.locator('button:has-text("Open")').first().click().catch(() => {});
await shoot(page, "121-report-detail.png", 900);

await browser.close();
console.log("\ndone ->", OUT);
