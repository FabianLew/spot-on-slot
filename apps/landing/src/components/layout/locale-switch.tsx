"use client";

import { useLocale, useTranslations } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const other = routing.locales.find((candidate) => candidate !== locale) ?? routing.defaultLocale;
  // A plain anchor on purpose: switching locale swaps the root layout (<html lang>), and a
  // client-side transition would re-render it in React, which cannot run next-themes'
  // inline theme script and logs "Encountered a script tag while rendering React component".
  return (
    <a
      href={getPathname({ href: pathname, locale: other })}
      hrefLang={other}
      className={className}
      data-umami-event="locale-switch"
      data-umami-event-to={other}
    >
      {t("switchLocale")}
    </a>
  );
}
