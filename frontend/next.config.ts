const nextConfig = {
  trailingSlash: true,
  devIndicators: false,
  allowedDevOrigins: [
    "172.16.102.232",
  ],

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
