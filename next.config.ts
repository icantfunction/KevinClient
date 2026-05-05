import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images-pw.pixieset.com",
      },
    ],
  },
};

export default nextConfig;
