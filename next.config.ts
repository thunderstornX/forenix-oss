import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma engines have to be carried alongside the server, not
  // traced into the closure.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // Security headers applied to every response. These are the
  // baseline set every production app should ship. CSP is
  // deliberately omitted for now — a strict CSP needs careful
  // design around Tailwind 4's @theme inline + the inline Next.js
  // bootstrap script, and getting it wrong breaks the app silently
  // on first load. Pending a Phase 9.5+ CSP design pass.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Force HTTPS for two years; eligible for preload list.
          // Vercel sets a similar default; this makes it explicit
          // for self-hosters fronted by Caddy / nginx / etc.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // No framing. Prevents clickjacking. CSP frame-ancestors
          // is the modern replacement; this header keeps older
          // browsers safe too.
          { key: "X-Frame-Options", value: "DENY" },
          // No MIME sniffing. Forces the server-declared type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the origin only on cross-origin requests; full URL
          // stays internal. Standard sensible default.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Disable browser features we don't use. Add more as the
          // feature surface grows (geolocation, microphone, etc.).
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
