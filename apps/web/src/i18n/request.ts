import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "./locale";

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  return {
    locale,
    // One zone for server and client rendering, so formatted dates match during hydration.
    // Per-user time zones come with user settings.
    timeZone: "Europe/Warsaw",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
