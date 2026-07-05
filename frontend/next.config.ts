import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow images from common news sources
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
