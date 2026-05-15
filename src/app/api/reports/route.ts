import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.report.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      investigation: { select: { id: true, title: true, target: true } },
      case: { select: { id: true, title: true, caseNumber: true } },
      generator: { select: { id: true, name: true } },
    },
  });
  return Response.json({ data: rows });
}
