import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@spot-on-slot/shared";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  // `/` follows Accept-Language only; on localhost a NEXT_LOCALE cookie would be shared with apps/web.
  localeCookie: false,
});
