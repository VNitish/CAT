import type { NextConfig } from "next";
import path from "path";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:4000";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  eslint: { ignoreDuringBuilds: true },

  // In dev, proxy /api/* to the standalone Express process (npm run dev:api).
  // On Vercel the /api/* paths are served directly by the api/[...all].js
  // serverless function and these rewrites are a no-op (NODE_ENV === 'production').
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
