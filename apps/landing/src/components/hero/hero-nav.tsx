"use client";

import { Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@spot-on-slot/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { ACTIVE_NAV_ITEM, NAV_ITEMS } from "./hero.config";

function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const other = routing.locales.find((candidate) => candidate !== locale) ?? routing.defaultLocale;
  return (
    <Link href={pathname} locale={other} hrefLang={other} className={className}>
      {t("switchLocale")}
    </Link>
  );
}

export function HeroNav() {
  const t = useTranslations("nav");
  const tHero = useTranslations("hero");
  const [open, setOpen] = useState(false);

  return (
    // While the menu sheet is open the nav drops below its overlay (z-50), so the overlay dims it too.
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 sm:p-5",
        open && "z-40",
      )}
    >
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 256 256" fill="#ffffff" aria-hidden="true">
          <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
        </svg>
        <span className="text-white text-2xl font-playfair italic">{tHero("brand")}</span>
      </div>

      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-2 py-2 items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={
              item.key === ACTIVE_NAV_ITEM
                ? "bg-white text-gray-900 px-4 py-1.5 rounded-full text-sm font-medium"
                : "text-white/80 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-white/20 hover:text-white transition-colors"
            }
          >
            {t(item.key)}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <LocaleSwitch className="hidden md:block text-white/80 hover:text-white text-sm" />
        <a
          href="#waitlist"
          className="hidden md:block bg-white text-gray-900 text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          {t("join")}
        </a>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden" aria-label={t("menu")}>
            <Menu className="text-white" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" closeLabel={t("closeMenu")} aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{t("menu")}</SheetTitle>
            </SheetHeader>
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-base font-medium"
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
            <LocaleSwitch className="text-sm font-medium" />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
