const DEFAULT_LANDING_URL = "http://localhost:3001";

// Landing slugs per locale (apps/landing routes); anything other than "en" gets the Polish pages.
const PATHS = {
  pl: { terms: "regulamin", privacy: "polityka-prywatnosci" },
  en: { terms: "terms", privacy: "privacy-policy" },
} as const;

export type LegalLinks = { terms: string; privacy: string };

/** Terms of service and privacy policy on the landing (`NEXT_PUBLIC_LANDING_URL`) in the given locale. */
export function getLegalLinks(locale: string): LegalLinks {
  // Direct property access so Next inlines the NEXT_PUBLIC_ value at build time.
  const base = (process.env.NEXT_PUBLIC_LANDING_URL?.trim() || DEFAULT_LANDING_URL).replace(/\/+$/, "");
  const lang = locale === "en" ? "en" : "pl";
  const paths = PATHS[lang];
  return { terms: `${base}/${lang}/${paths.terms}`, privacy: `${base}/${lang}/${paths.privacy}` };
}
