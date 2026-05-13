import { activeAdapterName } from "@/lib/ai/adapter";

const VERSION = "0.1.0";

export async function GET() {
  return Response.json({
    status: "ok",
    adapter: activeAdapterName(),
    version: VERSION,
    saasMode: process.env.SAAS_MODE === "true",
  });
}
