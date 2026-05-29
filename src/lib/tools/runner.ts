/**
 * Sandboxed tool runner.
 *
 * Three dispatchers depending on tool.kind:
 *   - subprocess: spawn the OSINT CLI, capture stdout+stderr, cap
 *     output bytes, kill on timeout.
 *   - http: nothing special  -  the tool's execute() makes its own
 *     fetch call. We just enforce overall timeout via abort.
 *   - builtin: pure JS function, no I/O concerns.
 *
 * For the Vercel deployment, subprocess tools call out to
 * WORKER_URL (the user's local laptop or a self-hosted worker)
 * instead of spawning locally. Implementation is the same shape;
 * we just delegate the spawn.
 */
import { spawn, type SpawnOptions } from "node:child_process";

import type { Tool, ToolCall, ToolResult } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 16_000;

export async function runToolCall(tool: Tool, call: ToolCall): Promise<ToolResult> {
  const start = Date.now();
  const id = call.id;
  const cap = tool.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  try {
    // Optional: delegate subprocess tools to a remote worker.
    if (tool.kind === "subprocess" && process.env.WORKER_URL) {
      const output = await delegateToWorker(tool, call);
      return finalize(id, tool, true, output, start);
    }
    const result = await tool.execute(call.args);
    return finalize(id, tool, true, truncate(result, cap), start);
  } catch (err) {
    return {
      id,
      name: tool.name,
      ok: false,
      output: null,
      durationMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

function finalize(id: string, tool: Tool, ok: boolean, output: unknown, start: number): ToolResult {
  return {
    id,
    name: tool.name,
    ok,
    output,
    durationMs: Date.now() - start,
  };
}

function truncate(value: unknown, maxBytes: number): unknown {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (Buffer.byteLength(s, "utf-8") <= maxBytes) {
    return value;
  }
  const sliced = Buffer.from(s, "utf-8").subarray(0, maxBytes).toString("utf-8");
  return {
    truncated: true,
    bytes: maxBytes,
    payload: sliced + "...",
  };
}

/**
 * Build a minimal environment for an OSINT subprocess.
 *
 * The app's own process.env carries secrets — OPENROUTER_API_KEY,
 * AUTH_SECRET, DATABASE_URL, the Anthropic key in the SaaS overlay, ...
 * None of them belong in a third-party CLI's environment, where a
 * crash dump, a verbose flag, or a malicious tool could surface them.
 * So we pass only what the tools genuinely need: PATH to locate the
 * binary, HOME so the Go tools (subfinder / nuclei) can read their
 * ~/.config provider files, the locale so Unicode output isn't
 * mangled, and TMPDIR — plus any keys the caller explicitly opts in
 * via `env` (e.g. a single tool's API key).
 */
function minimalEnv(extra?: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const base: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL,
    TMPDIR: process.env.TMPDIR,
    ...extra,
  };
  const out = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Spawn a subprocess, collect stdout (capped), enforce timeout. */
export async function spawnTool(args: {
  cmd: string;
  argv: string[];
  timeoutMs?: number;
  maxBytes?: number;
  /** Written to the child's stdin, then closed. Lets tools that read
   *  their target from stdin (dnsx, httpx) avoid a `sh -c` pipe — no
   *  shell, no interpolation, nothing to inject into. */
  input?: string;
  /** Extra env vars to pass through (e.g. a single tool's API key).
   *  The base env is otherwise minimal — see minimalEnv(). */
  env?: Record<string, string | undefined>;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = args.maxBytes ?? 1024 * 1024;

  return new Promise((resolve, reject) => {
    const spawnOpts: SpawnOptions = {
      // stdin is always a pipe; we write `input` when given, then
      // always close it so tools that read stdin see EOF, never hang.
      stdio: ["pipe", "pipe", "pipe"],
      env: minimalEnv(args.env),
    };
    const proc = spawn(args.cmd, args.argv, spawnOpts);
    if (!proc.stdin || !proc.stdout || !proc.stderr) {
      reject(new Error("failed to open subprocess pipes"));
      return;
    }
    // The child may exit before draining stdin; swallow EPIPE.
    proc.stdin.on("error", () => {});
    if (args.input != null) proc.stdin.write(args.input);
    proc.stdin.end();
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < maxBytes) {
        stdout += chunk.toString("utf-8");
        if (stdout.length > maxBytes) stdout = stdout.slice(0, maxBytes);
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 8 * 1024) {
        stderr += chunk.toString("utf-8");
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error(`tool timed out after ${timeoutMs} ms`));
      } else {
        resolve({ exitCode: code ?? -1, stdout, stderr });
      }
    });
  });
}

/** When running on Vercel, ship the call to WORKER_URL and trust it.
 *  The worker is expected to expose POST /run with shape:
 *    { tool: "<name>", args: {...} } -> { output: any }
 */
async function delegateToWorker(tool: Tool, call: ToolCall): Promise<unknown> {
  const base = process.env.WORKER_URL!;
  const res = await fetch(`${base.replace(/\/+$/, "")}/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.WORKER_TOKEN ? { authorization: `Bearer ${process.env.WORKER_TOKEN}` } : {}),
    },
    body: JSON.stringify({ tool: tool.name, args: call.args }),
    signal: AbortSignal.timeout(tool.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`worker ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { output?: unknown; error?: string };
  if (data.error) throw new Error(`worker error: ${data.error}`);
  return data.output;
}
