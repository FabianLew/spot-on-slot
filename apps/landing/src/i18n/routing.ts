import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@spot-on-slot/shared";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  // `/` follows Accept-Language only; on localhost a NEXT_LOCALE cookie would be shared with apps/web.
  localeCookie: false,
  // Keys are the folders under `app/[locale]`; the legal pages get a translated address per locale.
  pathnames: {
    "/": "/",
    "/waitlist/confirm": "/waitlist/confirm",
    "/polityka-prywatnosci": { pl: "/polityka-prywatnosci", en: "/privacy-policy" },
    "/regulamin": { pl: "/regulamin", en: "/terms" },
  },
});

export type AppPathname = keyof typeof routing.pathnames;
