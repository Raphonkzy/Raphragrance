import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // Static export for Flask/Gunicorn to serve
  trailingSlash: true,
  images: {
    unoptimized: true,       // Required for static export
    remotePatterns: [
      { protocol: "https", hostname: "fimgs.net" },
      { protocol: "https", hostname: "fragella.com" },
      { protocol: "https", hostname: "api.fragella.com" },
    ],
  },
};

export default nextConfig;
