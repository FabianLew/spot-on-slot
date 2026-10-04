import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@spot-on-slot/api-client",
    "@spot-on-slot/design-tokens",
    "@spot-on-slot/shared",
    "@spot-on-slot/ui",
  ],
};

export default nextConfig;
