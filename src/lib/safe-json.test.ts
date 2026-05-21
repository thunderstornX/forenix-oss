/**
 * Tests for src/lib/safe-json.ts.
 */
import { describe, expect, it } from "bun:test";

import { jsonOk, stringifyBigIntSafe } from "./safe-json";

describe("safe-json", () => {
  it("stringifyBigIntSafe coerces BigInt to decimal string", () => {
    expect(stringifyBigIntSafe({ size: BigInt("123456789012345678901") })).toBe(
      `{"size":"123456789012345678901"}`,
    );
  });

  it("leaves non-BigInt values untouched", () => {
    expect(stringifyBigIntSafe({ n: 42, s: "x", b: true, a: [1, 2] })).toBe(
      `{"n":42,"s":"x","b":true,"a":[1,2]}`,
    );
  });

  it("handles nested + array BigInts", () => {
    const v = { rows: [{ size: BigInt(7) }, { size: BigInt(11) }] };
    expect(stringifyBigIntSafe(v)).toBe(`{"rows":[{"size":"7"},{"size":"11"}]}`);
  });

  it("jsonOk returns a 200 Response with content-type JSON", async () => {
    const res = jsonOk({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("jsonOk passes through status + headers init", async () => {
    const res = jsonOk({ error: "x" }, { status: 422, headers: { "x-foo": "bar" } });
    expect(res.status).toBe(422);
    expect(res.headers.get("x-foo")).toBe("bar");
  });

  it("jsonOk serialises a body containing BigInt without throwing", async () => {
    const res = jsonOk({ data: { size: BigInt("9999999999999999999") } });
    expect(await res.text()).toContain(`"size":"9999999999999999999"`);
  });
});
