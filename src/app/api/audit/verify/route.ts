import { verifyAuditChain } from "@/lib/audit";

export async function GET() {
  const result = await verifyAuditChain();
  return Response.json({ data: result });
}
