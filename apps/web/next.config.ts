import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@spot-on-slot/api-client",
    "@spot-on-slot/design-tokens",
    "@spot-on-slot/shared",
    "@spot-on-slot/ui",
  ],
};

export default withNextIntl(nextConfig);
