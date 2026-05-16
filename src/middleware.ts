/**
 * Middleware — every request that's not on a public route gets
 * checked against the next-auth JWT.  Unauthenticated requests get
 * bounced to /sign-in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_ROUTES = new Set<string>([
  "/sign-in",
  "/favicon.ico",
  "/robots.txt",
]);
// /accept-invite is gated, but in a different way — the page itself
// only needs an authenticated user (so they know who's accepting).
// Keep it under the middleware umbrella.
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/admin/seed-demo", // token-gated, bootstraps fresh deploys
  "/_next/",
  "/_vercel/",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
