import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server.js + node_modules subset under
  // .next/standalone. Used by the Docker runtime image.
  output: "standalone",
  // Prisma engines have to be carried alongside the server, not
  // traced into the closure.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
