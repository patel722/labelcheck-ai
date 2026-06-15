import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;

initOpenNextCloudflareForDev();
