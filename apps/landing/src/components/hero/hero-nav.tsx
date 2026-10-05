"use client";

import { Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@spot-on-slot/ui";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { ACTIVE_NAV_ITEM, HERO_SECTION_ID, NAV_ITEMS } from "./hero.config";
import { useInView } from "./use-in-view";

// The nav counts as "over the hero" while the hero still reaches below the nav bar (about 80 px).
const NAV_OVERLAP_MARGIN = "-80px 0px 0px 0px";

function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const other = routing.locales.find((candidate) => candidate !== locale) ?? routing.defaultLocale;
  // A plain anchor on purpose: switching locale swaps the root layout (<html lang>), and a
  // client-side transition would re-render it in React, which cannot run next-themes'
  // inline theme script and logs "Encountered a script tag while rendering React component".
  return (
    <a href={getPathname({ href: pathname, locale: other })} hrefLang={other} className={className}>
      {t("switchLocale")}
    </a>
  );
}

export function HeroNav() {
  const t = useTranslations("nav");
  const tHero = useTranslations("hero");
  const [open, setOpen] = useState(false);
  // Over the hero the nav is the transparent frosted-glass version from the prompt; below it
  // the white text would vanish on light sections, so it gets a solid theme background.
  const overHero = useInView(HERO_SECTION_ID, NAV_OVERLAP_MARGIN);

  return (
    // While the menu sheet is open the nav drops below its overlay (z-50), so the overlay dims it too.
    <nav
      data-over-hero={overHero}
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 sm:p-5",
        !overHero && "bg-background/95 text-foreground border-b border-border shadow-sm backdrop-blur-md",
        open && "z-40",
      )}
    >
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 256 256" fill={overHero ? "#ffffff" : "currentColor"} aria-hidden="true">
          <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
        </svg>
        <span className={cn("text-2xl font-playfair italic", overHero ? "text-white" : "text-foreground")}>{tHero("brand")}</span>
      </div>

      <div
        className={cn(
          "hidden md:flex absolute left-1/2 -translate-x-1/2 rounded-full px-2 py-2 items-center gap-1",
          overHero ? "bg-white/20 backdrop-blur-md border border-white/30" : "bg-muted border border-border",
        )}
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={
              item.key === ACTIVE_NAV_ITEM
                ? overHero
                  ? "bg-white text-gray-900 px-4 py-1.5 rounded-full text-sm font-medium"
                  : "bg-foreground text-background px-4 py-1.5 rounded-full text-sm font-medium"
                : overHero
                  ? "text-white/80 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-white/20 hover:text-white transition-colors"
                  : "text-muted-foreground px-4 py-1.5 rounded-full text-sm font-medium hover:bg-accent hover:text-foreground transition-colors"
            }
          >
            {t(item.key)}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <LocaleSwitch
          className={cn(
            "hidden md:block text-sm",
            overHero ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground",
          )}
        />
        <a
          href="#waitlist"
          className={cn(
            "hidden md:block text-sm font-semibold px-6 py-2.5 rounded-full transition-colors",
            overHero
              ? "bg-white text-gray-900 hover:bg-gray-100"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {t("join")}
        </a>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden" aria-label={t("menu")}>
            <Menu className={overHero ? "text-white" : "text-foreground"} aria-hidden="true" />
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
