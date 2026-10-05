import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@spot-on-slot/shared";

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

function fromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const candidates = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return {
        primary: tag.trim().toLowerCase().split("-")[0],
        q: Number.isNaN(q) ? 0 : q,
        index,
      };
    })
    .filter((c) => c.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return candidates.map((c) => c.primary).find(isLocale);
}

export function resolveLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
