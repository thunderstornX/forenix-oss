import { activeAdapterName } from "@/lib/ai/adapter";
import { buildInfo } from "@/lib/build-info";
import pkg from "../../../../package.json";

export async function GET() {
  const { commit, builtAt } = buildInfo();
  return Response.json({
    status: "ok",
    adapter: activeAdapterName(),
    version: pkg.version,
    saasMode: process.env.SAAS_MODE === "true",
    commit,
    builtAt,
  });
}
