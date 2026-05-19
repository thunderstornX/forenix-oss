/**
 * Middleware  -  every request that's not on a public route gets
 * checked against the next-auth JWT.  Unauthenticated requests get
 * bounced to /sign-in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_ROUTES = new Set<string>([
  "/",            // marketing landing
  "/sign-in",
  "/waitlist",    // standalone waitlist sign-up page
  "/favicon.ico",
  "/robots.txt",
  "/api/health",  // liveness probe — load balancers, smoke checks, uptime monitors
]);
// /accept-invite is gated, but in a different way  -  the page itself
// only needs an authenticated user (so they know who's accepting).
// Keep it under the middleware umbrella.
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/admin/seed-demo",        // token-gated, bootstraps fresh deploys
  "/api/admin/waitlist-import",  // token-gated cross-deployment waitlist sync (WAITLIST_SYNC_TOKEN)
  "/api/waitlist",               // public sign-up endpoint
  "/api/internal/",              // token-gated scheduler tick (MONITOR_CRON_TOKEN / CRON_SECRET)
  "/_next/",
  "/_vercel/",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Detect HTTPS behind a reverse proxy. getToken() uses req.url to
  // decide whether to look for the `__Secure-` cookie; that URL is
  // always http://localhost:3000 once Caddy forwards to Bun, so we
  // pass `secureCookie` explicitly. Honoured signals (in order):
  //   - AUTH_URL / NEXTAUTH_URL begins with https://
  //   - X-Forwarded-Proto: https from a trusted proxy
  const xfp = req.headers.get("x-forwarded-proto");
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const isHttps = authUrl.startsWith("https://") || xfp === "https";

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: isHttps,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /* match everything except static assets */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
