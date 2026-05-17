/**
 * GET /api/cases/[id]/report           - HTML preview (in-browser print works)
 * GET /api/cases/[id]/report?format=pdf - rendered PDF via Playwright (self-host)
 *
 * The PDF format requires a runtime that can spawn Chromium. On
 * serverless hosts (Vercel) we return 503 with a clear message so the
 * UI can offer the HTML version as a fallback.
 */
import { appendAudit } from "@/lib/audit";
import { verifyAuditChain } from "@/lib/audit";
import {
  buildCaseReportData,
  renderCaseReportHtml,
} from "@/lib/case-report";
import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession } from "@/lib/rbac";

export const runtime = "nodejs";
export const maxDuration = 60;

function pdfRenderingEnabled(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.VERCEL_URL) return false;
  if (process.env.FORENIX_DISABLE_PDF === "1") return false;
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireSession();
    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "html";

    if (format === "pdf" && !pdfRenderingEnabled()) {
      return Response.json(
        {
          error: "pdf_unavailable",
          details:
            "PDF rendering requires a host with Chromium. This serverless " +
            "deployment can't spawn the browser. Use ?format=html to " +
            "preview, or self-host to enable PDF export.",
        },
        { status: 503 },
      );
    }

    // Verify chain + build the data shape.
    const chainCheck = await verifyAuditChain();
    const brokenAt = chainCheck.ok ? null : chainCheck.brokenAt;
    const data = await buildCaseReportData({
      caseId: id,
      generatedBy: actor.name ?? actor.email ?? actor.userId,
      prisma: prisma as unknown as Parameters<typeof buildCaseReportData>[0]["prisma"],
      verify: () => ({ ok: chainCheck.ok, brokenAt }),
    });
    if (!data) return Response.json({ error: "case_not_found" }, { status: 404 });

    await appendAudit({
      action: "generate_case_report",
      entity: "Case",
      entityId: data.case.id,
      userId: actor.userId,
      caseId: data.case.id,
      details: { format, chainOk: chainCheck.ok, evidenceCount: data.evidence.length, findingCount: data.findings.length },
    });

    const html = renderCaseReportHtml(data);

    if (format !== "pdf") {
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Render the PDF via Playwright. Heavy import; only loaded on the
    // self-host branch.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({
        viewport: { width: 1240, height: 1754 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${data.case.caseNumber}-report.pdf"`,
          "x-case-id": data.case.id,
          "x-chain-ok": chainCheck.ok ? "1" : "0",
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    return httpErrorResponse(err);
  }
}
