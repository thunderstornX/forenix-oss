import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const investigationId = url.searchParams.get("investigationId");

  const relations = await prisma.entityRelation.findMany({
    where: investigationId ? { investigationId } : undefined,
    include: {
      fromEntity: true,
      toEntity: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Collect unique entities referenced by the relations + any
  // unattached ones in the same scope.
  const seen = new Map<string, typeof relations[number]["fromEntity"]>();
  for (const r of relations) {
    seen.set(r.fromEntity.id, r.fromEntity);
    seen.set(r.toEntity.id, r.toEntity);
  }
  const all = await prisma.entity.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  for (const e of all) seen.set(e.id, e);

  return Response.json({
    data: {
      entities: Array.from(seen.values()),
      relations: relations.map((r) => ({
        id: r.id,
        from: r.fromEntityId,
        to: r.toEntityId,
        relationType: r.relationType,
        confidence: r.confidence,
        investigationId: r.investigationId,
      })),
    },
  });
}
