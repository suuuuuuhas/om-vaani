import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["ws"],
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;
