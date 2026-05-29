/**
 * Worker hardening tests.
 *
 * Uses only coreutils (printenv / cat / sleep) so it runs anywhere —
 * none of the OSINT binaries need to be installed. The arg-injection
 * guards are validated through each tool's execute(), which throws at
 * the regex before any process is spawned, so those are deterministic
 * regardless of what's on PATH.
 */
import { describe, expect, test } from "bun:test";

import { spawnTool } from "./runner";
import { sherlockTool } from "./catalogue/sherlock";
import { maigretTool } from "./catalogue/maigret";
import { holeheTool } from "./catalogue/holehe";

describe("spawnTool: minimal environment", () => {
  test("does not leak app secrets into the subprocess env", async () => {
    process.env.FORENIX_FAKE_SECRET = "should-not-leak-1234";
    try {
      const { stdout } = await spawnTool({ cmd: "printenv", argv: [], timeoutMs: 5_000 });
      expect(stdout).not.toContain("should-not-leak-1234");
      expect(stdout).not.toContain("FORENIX_FAKE_SECRET");
    } finally {
      delete process.env.FORENIX_FAKE_SECRET;
    }
  });

  test("preserves PATH (so the binary resolves)", async () => {
    const { stdout } = await spawnTool({ cmd: "printenv", argv: [], timeoutMs: 5_000 });
    expect(stdout).toContain("PATH=");
  });

  test("passes through only explicitly opted-in env vars", async () => {
    const { stdout } = await spawnTool({
      cmd: "printenv",
      argv: [],
      env: { TOOL_API_KEY: "opted-in-value" },
      timeoutMs: 5_000,
    });
    expect(stdout).toContain("TOOL_API_KEY=opted-in-value");
  });
});

describe("spawnTool: stdin + timeout", () => {
  test("writes input to stdin (no shell pipe needed)", async () => {
    const { stdout } = await spawnTool({
      cmd: "cat",
      argv: [],
      input: "hello-stdin\n",
      timeoutMs: 5_000,
    });
    expect(stdout).toContain("hello-stdin");
  });

  test("kills + rejects on timeout", async () => {
    await expect(
      spawnTool({ cmd: "sleep", argv: ["5"], timeoutMs: 300 }),
    ).rejects.toThrow(/timed out/);
  });
});

describe("arg-injection guards: positional-arg tools reject flag-like input", () => {
  test("sherlock rejects a leading-dash username", async () => {
    await expect(sherlockTool.execute({ username: "-rf" })).rejects.toThrow(/invalid/i);
  });

  test("maigret rejects a flag-shaped username", async () => {
    await expect(maigretTool.execute({ username: "--top-sites" })).rejects.toThrow(/invalid/i);
  });

  test("holehe rejects a leading-dash address", async () => {
    await expect(holeheTool.execute({ email: "-x@y.com" })).rejects.toThrow(/invalid/i);
  });
});
