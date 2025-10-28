import type { NextConfig } from "next";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "fake://stub";
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
