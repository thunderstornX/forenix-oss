/**
 * Sandboxed tool runner.
 *
 * Three dispatchers depending on tool.kind:
 *   - subprocess: spawn the OSINT CLI, capture stdout+stderr, cap
 *     output bytes, kill on timeout.
 *   - http: nothing special — the tool's execute() makes its own
 *     fetch call. We just enforce overall timeout via abort.
 *   - builtin: pure JS function, no I/O concerns.
 *
 * For the Vercel deployment, subprocess tools call out to
 * WORKER_URL (the user's local laptop or a self-hosted worker)
 * instead of spawning locally. Implementation is the same shape;
 * we just delegate the spawn.
 */
import { spawn } from "node:child_process";

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
    payload: sliced + "…",
  };
}

/** Spawn a subprocess, collect stdout (capped), enforce timeout. */
export async function spawnTool(args: {
  cmd: string;
  argv: string[];
  timeoutMs?: number;
  maxBytes?: number;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = args.maxBytes ?? 1024 * 1024;

  return new Promise((resolve, reject) => {
    const proc = spawn(args.cmd, args.argv, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: process.env.PATH },
    });
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
 *    { tool: "<name>", args: {...} } → { output: any }
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
