import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['modesl'],
  async redirects() {
    return [
      { source: '/hotlines', destination: '/inbound', permanent: false },
    ];
  },
};

export default nextConfig;
