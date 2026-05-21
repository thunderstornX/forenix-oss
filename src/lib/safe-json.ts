/**
 * BigInt-safe JSON response helper.
 *
 * Prisma returns `BigInt` for any column typed `BigInt` (notably
 * `Evidence.size` and `Evidence.byteCount`). The platform's JSON
 * serializer (`Response.json` → `JSON.stringify`) throws on
 * `BigInt` with `TypeError: Do not know how to serialize a BigInt`.
 *
 * Every route that returns a Prisma row containing `BigInt`
 * directly to the client needs to coerce. Rather than scatter the
 * replacer everywhere, use this helper:
 *
 *   import { jsonOk } from "@/lib/safe-json";
 *   return jsonOk({ data: evidence });
 *
 * Coerces `BigInt` to a decimal string at the JSON boundary.
 * Numeric precision is preserved (BigInt has no upper bound;
 * decimal-string-on-wire keeps it exact for the client).
 *
 * NOTE: deliberately no `import "server-only"` so bun:test can
 * load the file.
 */

export function stringifyBigIntSafe(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

export function jsonOk(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
): Response {
  return new Response(stringifyBigIntSafe(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}
