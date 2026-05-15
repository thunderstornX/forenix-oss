import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.agent.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      tasks: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { tasks: true, assignments: true } },
    },
  });
  return Response.json({ data: rows });
}
