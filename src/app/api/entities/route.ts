import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const actor = await requireSession();
    const url = new URL(request.url);
    const investigationId = url.searchParams.get("investigationId");
    const scope = teamScopeWhere(actor);

    // EntityRelation rows belong to an Investigation, so we scope
    // through the parent. If the caller supplied an investigationId,
    // narrow further; otherwise show all relations the actor can see.
    const whereRel = investigationId
      ? { investigationId, investigation: scope }
      : { investigation: scope };

    const relations = await prisma.entityRelation.findMany({
      where: whereRel,
      include: {
        fromEntity: true,
        toEntity: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Collect the entities actually referenced by in-scope relations.
    // We deliberately do not expose the global Entity table any more,
    // because there is no per-entity tenant column to scope on. Any
    // unreferenced entities only surface once they are connected via
    // a relation the actor can see.
    const seen = new Map<string, typeof relations[number]["fromEntity"]>();
    for (const r of relations) {
      seen.set(r.fromEntity.id, r.fromEntity);
      seen.set(r.toEntity.id, r.toEntity);
    }

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
  } catch (err) {
    return httpErrorResponse(err);
  }
}
