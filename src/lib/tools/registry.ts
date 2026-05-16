/**
 * Tool registry — single source of truth.
 *
 * To add a tool: create a file under catalogue/, import it here,
 * add it to ALL_TOOLS. The factory does the rest.
 */
import type { AgentGroup, Tool } from "./types";

import { crtshTool } from "./catalogue/crtsh";
import { duckDuckGoSearchTool } from "./catalogue/duckduckgo-search";
import { holeheTool } from "./catalogue/holehe";
import { httpFetchTool } from "./catalogue/http-fetch";
import { sherlockTool } from "./catalogue/sherlock";
import { theHarvesterTool } from "./catalogue/the-harvester";
import { whoisTool } from "./catalogue/whois";

export const ALL_TOOLS: readonly Tool[] = [
  // builtins — work everywhere
  duckDuckGoSearchTool,
  httpFetchTool,
  // HTTP-API tools — work on Vercel
  crtshTool,
  whoisTool,
  // subprocess tools — self-host (or WORKER_URL on Vercel)
  sherlockTool,
  holeheTool,
  theHarvesterTool,
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
