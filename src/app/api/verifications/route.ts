import { prisma } from "@/lib/db";
import { httpErrorResponse, requireSession, teamScopeWhere } from "@/lib/rbac";

export async function GET() {
  try {
    const actor = await requireSession();
    // Verification hangs off Investigation; scope through the parent.
    const rows = await prisma.verification.findMany({
      where: { investigation: teamScopeWhere(actor) },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ data: rows });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
