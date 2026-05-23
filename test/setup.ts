/**
 * Bun test preload. Runs before any test module.
 *
 * Neutralises the `server-only` marker package so modules that
 * `import "server-only"` (rbac.ts, db.ts, audit.ts) can be loaded
 * from the test runner without throwing the Client Component error.
 */
import { mock } from "bun:test";

mock.module("server-only", () => ({}));
