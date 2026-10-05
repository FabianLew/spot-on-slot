import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/**
 * `/` redirects by Accept-Language; locale-prefixed paths go through next-intl.
 * Any other first segment (e.g. `/de`) is left alone so `[locale]/layout.tsx` answers 404
 * instead of next-intl redirecting it to `/pl/de`.
 */
export default function proxy(request: NextRequest) {
  const [firstSegment] = request.nextUrl.pathname.split("/").filter(Boolean);
  if (firstSegment !== undefined && !hasLocale(routing.locales, firstSegment)) {
    return NextResponse.next();
  }
  return handleI18nRouting(request);
}

export const config = {
  // Everything except Next internals, the hero images and files with an extension.
  matcher: ["/((?!_next|_vercel|hero|.*\\..*).*)"],
};
