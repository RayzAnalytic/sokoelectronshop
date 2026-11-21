import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  devIndicators: false,
  allowedDevOrigins: [
    "172.16.102.232",
  ],
};

export default nextConfig;
