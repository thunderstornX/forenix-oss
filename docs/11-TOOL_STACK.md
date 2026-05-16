# Tool stack

> Phase B retires the `syntheticSearchResults` fake-input pipeline.
> The LLM is now invoked with **real tools** and chooses which ones
> to run.

## How it works

The platform exposes a **tool registry** (`src/lib/tools/registry.ts`)
to whichever AI adapter is active. Each tool is a single TypeScript
file under `src/lib/tools/catalogue/`. The model receives the tool
list as OpenAI function-calling schemas and decides — call by call,
in a loop — which to invoke.

| Tool | Kind | Runs on Vercel? | Notes |
|---|---|---|---|
| `web_search` | builtin | ✅ | DuckDuckGo HTML scrape, no key |
| `http_fetch` | builtin | ✅ | Fetches a page, returns truncated body |
| `crtsh_lookup` | http | ✅ | Certificate-transparency log via crt.sh |
| `whois_dns` | http | ✅ | hackertarget WHOIS + DNS, no key |
| `sherlock_username` | subprocess | self-host only* | 400+ social-network username search |
| `holehe_email` | subprocess | self-host only* | Email → which services it's registered on |
| `the_harvester` | subprocess | self-host only* | Emails / subdomains / hosts for a domain |

\* *Subprocess tools also work on Vercel if `WORKER_URL` is set; see
[Vercel + worker laptop](#vercel--worker-laptop) below.*

## Installing the subprocess tools (self-host)

```bash
# Python tooling (pipx recommended)
pipx install sherlock-project
pipx install holehe
pipx install theHarvester
```

After install, `which sherlock holehe theHarvester` should show
three paths. The platform spawns them as subprocesses with caps on
runtime + output size.

## Vercel + worker laptop

Vercel functions can't spawn subprocesses. Two ways to still use
the subprocess tools from a Vercel deployment:

### Option A — laptop as worker

1. Install the OSINT tools on your laptop.
2. Run a tiny worker that exposes `POST /run`:
   ```ts
   // Sketch — implementation lives in `worker/` (Phase B.1).
   ```
3. Expose it via cloudflared / ngrok.
4. Set Vercel env: `WORKER_URL=https://your-tunnel-host.trycloudflare.com`
   and (optionally) `WORKER_TOKEN=…` for bearer-auth.

When the laptop is online, subprocess tools work end-to-end. When
it's offline, the runner sees the unavailable worker, the platform
falls back to the API-only tools, and the demo continues with a
narrower toolset.

### Option B — dedicated worker container

Deploy the same worker as a container on Fly.io / Railway / a small
VPS. Same `WORKER_URL` env. Full feature parity, always-on cost
(usually ~$5/mo at this scale).

## Adding a new tool

Drop a single file under `src/lib/tools/catalogue/`:

```ts
import type { Tool } from "../types";

export const myTool: Tool = {
  name: "my_tool",
  description: "What it does. The LLM reads this verbatim.",
  parameters: {
    type: "object",
    properties: { ... },
    required: [ ... ],
  },
  kind: "http", // or "subprocess" / "builtin"
  groups: ["identity", "infrastructure"],
  async execute(args) { ... },
};
```

Add it to the import + `ALL_TOOLS` array in `registry.ts`. Done.
The model picks it up next pipeline run.

## Limits + safety

Every tool call goes through the runner with hard limits:

- **Timeout** — default 30 s per tool call, configurable per-tool.
- **Output size** — default 16 KB returned to the LLM. Larger
  outputs are truncated with a `truncated: true` marker.
- **Argument validation** — each tool validates inputs before
  spawn / fetch (regex for domains, emails, etc.).
- **No shell** — subprocess tools are spawned with `argv`, not
  shell strings; injection-safe.
- **Bounded loop** — the model is allowed `maxIterations = 6` of
  tool-call rounds. After that we force a final answer with tools
  disabled.

## Why this matters

Without real tools, an LLM is a hallucination engine over an empty
context. With tools, the same LLM becomes an analyst — running
real WHOIS, real cert-transparency lookups, real username
enumeration, fetching real pages — and grounding every finding in
verifiable evidence.

This is the layer where `forenix-oss` stops being a UI over
synthetic data and starts being a real OSINT platform.
