import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/hotlines', destination: '/inbound', permanent: false },
      { source: '/hotlines/new', destination: '/inbound/new', permanent: false },
    ];
  },
};

export default nextConfig;
