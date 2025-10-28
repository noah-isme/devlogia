import type { NextConfig } from "next";
import createMDX from "@next/mdx";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "fake://stub";
}

const withMDX = createMDX({ extension: /\.mdx?$/ });

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["sonner", "@aws-sdk/client-s3", "zod"],
  },
};

export default withMDX(nextConfig);
