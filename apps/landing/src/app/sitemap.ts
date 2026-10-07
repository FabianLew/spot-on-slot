import type { MetadataRoute } from "next";
import { routing, type AppPathname } from "@/i18n/routing";
import { absoluteUrl, pageAlternates } from "@/lib/site";

// The confirmation page is `noindex`, so it stays out.
const PAGES: { href: AppPathname; priority: number }[] = [
  { href: "/", priority: 1 },
  { href: "/polityka-prywatnosci", priority: 0.3 },
  { href: "/regulamin", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ href, priority }) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(href, locale),
      priority,
      alternates: { languages: pageAlternates(href, locale).languages },
    })),
  );
}
