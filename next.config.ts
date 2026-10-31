import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  serverExternalPackages: ["node:sqlite"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "fimgs.net" },
    ],
  },
};

export default nextConfig;
