import { activeAdapterName } from "@/lib/ai/adapter";
import pkg from "../../../../package.json";

export async function GET() {
  return Response.json({
    status: "ok",
    adapter: activeAdapterName(),
    version: pkg.version,
    saasMode: process.env.SAAS_MODE === "true",
  });
}
