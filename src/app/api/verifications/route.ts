import { prisma } from "@/lib/db";

export async function GET() {
  const rows = await prisma.verification.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ data: rows });
}
