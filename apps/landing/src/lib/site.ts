import type { Locale } from "@spot-on-slot/shared";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppPathname } from "@/i18n/routing";

/** Public address of the landing; production builds fail without it (next.config.ts). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3001").replace(/\/+$/, "");
}

export function absoluteUrl(href: AppPathname, locale: Locale): string {
  return `${siteUrl()}${getPathname({ href, locale })}`;
}

/** Canonical address plus hreflang alternates (and `x-default` on the default locale) for one page. */
export function pageAlternates(href: AppPathname, locale: Locale) {
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((candidate) => [candidate, absoluteUrl(href, candidate)]),
  );
  languages["x-default"] = absoluteUrl(href, routing.defaultLocale);
  return { canonical: absoluteUrl(href, locale), languages };
}

const OG_LOCALES = { pl: "pl_PL", en: "en_US" } as const;

/**
 * Open Graph fields every page shares. Next replaces `openGraph` as a whole when a page sets it,
 * so pages spread this instead of relying on the layout's.
 */
export function baseOpenGraph(locale: Locale) {
  return {
    type: "website" as const,
    siteName: "Spot On Slot",
    locale: OG_LOCALES[locale],
    alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALES[other]),
  };
}
