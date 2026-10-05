import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

if (
  process.env.LANDING_ENV === "production" &&
  (!process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER || !process.env.NEXT_PUBLIC_PRIVACY_EMAIL)
) {
  throw new Error(
    "NEXT_PUBLIC_PRIVACY_CONTROLLER and NEXT_PUBLIC_PRIVACY_EMAIL are required for a production landing build",
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
