import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "smartfit.s3.us-east-1.amazonaws.com",
      },
    ],
  },
  output: "standalone",
};

export default nextConfig;
