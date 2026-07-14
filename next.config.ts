import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client-only MBTA + weather; no Node server required at runtime on Vercel.
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
