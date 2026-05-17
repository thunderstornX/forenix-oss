import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma engines have to be carried alongside the server, not
  // traced into the closure.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
