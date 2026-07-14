import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Client-only MBTA + weather; no Node server required at runtime on Vercel.
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
