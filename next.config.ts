import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node:sqlite"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "fimgs.net" },
    ],
  },
};

export default nextConfig;
