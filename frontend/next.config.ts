import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Every /api/* request from the browser is proxied to Django
        // on 127.0.0.1:8000. This means:
        //   • No CORS setup needed — browser sees same-origin
        //   • Session cookies flow automatically
        //   • Frontend fetch("/api/v1/auth/me/") just works
        //
        // The trailing /*/ on the destination is important: Django's
        // URL patterns all end in "/" (e.g. /api/v1/auth/me/), but
        // Next.js strips trailing slashes before applying a rewrite.
        // Baking the slash into the destination ensures Django sees
        // exactly the URL it expects and doesn't redirect in a loop.
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*/",
      },
    ];
  },
};

export default nextConfig;