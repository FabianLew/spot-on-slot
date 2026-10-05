import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/preferences/locale-switch";

/** Account pages (sign-up, sign-in, e-mail links) live outside the app shell and need no session. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <main id="main" className="pattern-grid flex flex-1 justify-center px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-4xl flex-col gap-10">
        <div className="flex items-start justify-between gap-6">
          <Link href="/register" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo label={t("appName")} className="[&>span:first-child]:text-3xl sm:[&>span:first-child]:text-4xl [&>span:last-child]:hidden" />
          </Link>
          <LocaleSwitch />
        </div>
        {children}
      </div>
    </main>
  );
}
