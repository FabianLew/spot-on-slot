import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/preferences/locale-switch";

/** Public profiles: open to everyone, outside the app shell and its sign-in. */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("common");
  return (
    <main id="main" className="pattern-grid flex flex-1 justify-center px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-start justify-between gap-6">
          <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo label={t("appName")} className="[&>span:first-child]:text-2xl [&>span:last-child]:hidden" />
          </Link>
          <LocaleSwitch />
        </div>
        {children}
      </div>
    </main>
  );
}
