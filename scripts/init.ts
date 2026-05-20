#!/usr/bin/env bun
/**
 * forenix init - one-shot investigation bootstrap from the shell.
 *
 * The CLI sibling of POST /api/investigations/init. Self-contained:
 * talks directly to Postgres (so no need to negotiate auth), then
 * prints the URLs the operator needs to pick the investigation up
 * in the UI or fire the pipeline runner against it.
 *
 * Usage:
 *   bun scripts/init.ts \
 *     --target sigstore.dev \
 *     --type domain \
 *     --objective "map public infrastructure + attest chain integrity"
 *
 * Optional flags:
 *   --title "..."       override the auto-derived title
 *   --priority high     low | medium | high | critical (default medium)
 *   --created-by "..."  override the createdBy column (default "operator-cli")
 *
 * Lives in OSS Core because self-hosters benefit from it too.
 */
import { PrismaClient } from "@prisma/client";

const VALID_TYPES = new Set([
  "domain",
  "person",
  "organization",
  "ip",
  "username",
  "phone",
  "image",
  "compound",
]);

function defaultAgentGroups(targetType: string): string[] {
  switch (targetType) {
    case "domain":       return ["identity", "infrastructure"];
    case "ip":           return ["infrastructure"];
    case "person":       return ["identity", "social", "geo"];
    case "organization": return ["identity", "infrastructure", "financial"];
    case "username":     return ["identity", "social"];
    case "phone":        return ["identity"];
    case "image":        return ["identity", "geo"];
    case "compound":     return ["identity", "infrastructure", "social", "relationships"];
    default:             return ["identity"];
  }
}

function autoTitle(target: string): string {
  const clean = target.length > 60 ? target.slice(0, 57) + "..." : target;
  return `Investigation: ${clean}`;
}

interface Args {
  target: string;
  type: string;
  objective: string;
  title?: string;
  priority?: string;
  createdBy?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--target":      out.target = next; i++; break;
      case "--type":        out.type = next; i++; break;
      case "--objective":   out.objective = next; i++; break;
      case "--title":       out.title = next; i++; break;
      case "--priority":    out.priority = next; i++; break;
      case "--created-by":  out.createdBy = next; i++; break;
    }
  }
  if (!out.target || !out.type || !out.objective) {
    console.error("Usage: bun scripts/init.ts --target <t> --type <T> --objective <obj> [--title ...] [--priority low|medium|high|critical] [--created-by ...]");
    process.exit(1);
  }
  if (!VALID_TYPES.has(out.type)) {
    console.error(`Invalid --type "${out.type}". Valid: ${[...VALID_TYPES].join(", ")}`);
    process.exit(1);
  }
  return out as Args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const groups = defaultAgentGroups(args.type);
  const title = args.title ?? autoTitle(args.target);
  const priority = (args.priority ?? "medium") as "low" | "medium" | "high" | "critical";

  const prisma = new PrismaClient();
  try {
    const inv = await prisma.investigation.create({
      data: {
        title,
        target:         args.target,
        targetType:     args.type,
        objective:      args.objective,
        priority,
        status:         "draft",
        pipelineConfig: JSON.stringify(groups),
        createdBy:      args.createdBy ?? "operator-cli",
        teamId:         null,
      },
      select: {
        id: true,
        title: true,
        target: true,
        targetType: true,
        priority: true,
        status: true,
        createdAt: true,
      },
    });

    console.log("");
    console.log("─── investigation created ───");
    console.log("  id:        ", inv.id);
    console.log("  title:     ", inv.title);
    console.log("  target:    ", inv.target, "  (type:", inv.targetType + ")");
    console.log("  priority:  ", inv.priority);
    console.log("  status:    ", inv.status);
    console.log("  agentGroups:", groups.join(", "));
    console.log("");
    console.log("─── next ───");
    console.log("  open in UI:  https://demo.forenix.tech/app?view=investigations&inv=" + inv.id);
    console.log("  run pipeline: from the UI, click Run; or POST to");
    console.log("                /api/pipeline/run/" + inv.id);
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
