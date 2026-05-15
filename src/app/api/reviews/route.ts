import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.mergeRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      case: { select: { id: true, title: true, caseNumber: true } },
      branch: { select: { name: true, color: true } },
      reviewer: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
  return Response.json({ data: rows });
}
