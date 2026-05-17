/**
 * Tool registry — single source of truth.
 *
 * To add a tool: create a file under catalogue/, import it here,
 * add it to ALL_TOOLS. The factory does the rest.
 */
import type { AgentGroup, Tool } from "./types";

import { crtshTool } from "./catalogue/crtsh";
import { duckDuckGoSearchTool } from "./catalogue/duckduckgo-search";
import { hibpBreachesTool } from "./catalogue/hibp";
import { holeheTool } from "./catalogue/holehe";
import { httpFetchTool } from "./catalogue/http-fetch";
import { hunterDomainTool } from "./catalogue/hunter";
import { sherlockTool } from "./catalogue/sherlock";
import { shodanHostTool } from "./catalogue/shodan";
import { theHarvesterTool } from "./catalogue/the-harvester";
import { whoisTool } from "./catalogue/whois";
// Deep subprocess toolchain — requires self-hosting (a real OS with
// these binaries installed; see docs/SELF_HOST.md). Gated by
// canSpawnLocally() below so Vercel deployments transparently skip
// them.
import { maigretTool } from "./catalogue/maigret";
import { subfinderTool } from "./catalogue/subfinder";
import { httpxTool } from "./catalogue/httpx";
import { dnsxTool } from "./catalogue/dnsx";
import { amassTool } from "./catalogue/amass";
import { nucleiTool } from "./catalogue/nuclei";
import { exiftoolTool } from "./catalogue/exiftool";
import { ytDlpTool } from "./catalogue/yt-dlp";
import { tesseractTool } from "./catalogue/tesseract";
import { gowitnessTool } from "./catalogue/gowitness";

export const ALL_TOOLS: readonly Tool[] = [
  // builtins — work everywhere
  duckDuckGoSearchTool,
  httpFetchTool,
  // HTTP-API tools (no key) — work on Vercel
  crtshTool,
  whoisTool,
  // API-keyed HTTP tools (admin-vault-gated) — work on Vercel
  shodanHostTool,
  hunterDomainTool,
  hibpBreachesTool,
  // subprocess tools — self-host (or WORKER_URL on Vercel)
  sherlockTool,
  holeheTool,
  theHarvesterTool,
  // Deep subprocess toolchain — self-host only
  maigretTool,
  subfinderTool,
  httpxTool,
  dnsxTool,
  amassTool,
  nucleiTool,
  exiftoolTool,
  ytDlpTool,
  tesseractTool,
  gowitnessTool,
];

export function getToolByName(name: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export function toolsForGroup(group: AgentGroup): Tool[] {
  return ALL_TOOLS.filter((t) => t.groups.includes(group));
}

/** Returns true if the tool can run in the current environment. */
export function isToolAvailable(tool: Tool): boolean {
  if (tool.apiKeyEnv && !process.env[tool.apiKeyEnv]) return false;
  // Subprocess tools require either a local binary or WORKER_URL.
  if (tool.kind === "subprocess") {
    return Boolean(process.env.WORKER_URL) || canSpawnLocally();
  }
  return true;
}

function canSpawnLocally(): boolean {
  // Vercel sets VERCEL=1; subprocess spawn is forbidden there.
  return !process.env.VERCEL && !process.env.VERCEL_URL;
}

/** Filter the per-group tool list down to what can actually run. */
export function availableToolsForGroup(group: AgentGroup): Tool[] {
  return toolsForGroup(group).filter(isToolAvailable);
}

/** OpenAI-shape tool definitions for tool_calls API. */
export function toolsAsOpenAISchema(tools: Tool[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Tool["parameters"] };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
