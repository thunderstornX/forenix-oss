import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.monitor.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      investigation: { select: { id: true, title: true, target: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 3 },
      _count: { select: { runs: true } },
    },
  });
  return Response.json({ data: rows });
}
