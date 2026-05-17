/**
 * Temporary debug endpoint: dumps what next/headers.cookies() sees +
 * the raw request headers + what auth() returns. Used to diagnose
 * the HTTPS reverse-proxy auth mismatch. Remove after the fix lands.
 */
import { cookies } from "next/headers";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((c) => ({ name: c.name, valueLen: c.value.length }));

  const session = await auth().catch((e) => ({ error: (e as Error).message }));

  const rawCookieHeader = request.headers.get("cookie") ?? "";
  const cookieNamesFromHeader = rawCookieHeader.split(";").map((s) => s.split("=")[0]?.trim()).filter(Boolean);

  return Response.json({
    request: {
      url: request.url,
      host: request.headers.get("host"),
      xForwardedProto: request.headers.get("x-forwarded-proto"),
      xForwardedHost: request.headers.get("x-forwarded-host"),
      origin: request.headers.get("origin"),
    },
    cookieStoreCount: allCookies.length,
    cookieStoreNames: allCookies.map((c) => c.name),
    rawCookieHeaderNames: cookieNamesFromHeader,
    authResult: session,
    env: {
      AUTH_URL: process.env.AUTH_URL ?? null,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
      AUTH_SECRET_LEN: (process.env.AUTH_SECRET ?? "").length,
    },
  });
}
