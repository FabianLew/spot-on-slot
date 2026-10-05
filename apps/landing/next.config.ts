import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const PRODUCTION_REQUIRED_ENV = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_PRIVACY_CONTROLLER",
  "NEXT_PUBLIC_PRIVACY_EMAIL",
] as const;

if (
  process.env.LANDING_ENV === "production" &&
  PRODUCTION_REQUIRED_ENV.some((name) => !process.env[name]?.trim())
) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_PRIVACY_CONTROLLER and NEXT_PUBLIC_PRIVACY_EMAIL are required for a production landing build",
  );
}

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
