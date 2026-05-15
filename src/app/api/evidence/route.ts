import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId");

  const rows = await prisma.evidence.findMany({
    where: caseId ? { caseId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      case: { select: { id: true, title: true, caseNumber: true } },
      _count: { select: { commits: true, findings: true, comments: true } },
    },
  });

  // Evidence.size is BigInt — coerce to string on the wire.
  const serialized = rows.map((r) => ({
    ...r,
    size: r.size.toString(),
  }));
  return Response.json({ data: serialized });
}
