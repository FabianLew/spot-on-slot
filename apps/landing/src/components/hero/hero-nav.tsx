"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@spot-on-slot/ui";
import { LocaleSwitch } from "@/components/layout/locale-switch";
import { ACTIVE_NAV_ITEM, HERO_SECTION_ID, NAV_ITEMS } from "./hero.config";
import { useInView } from "./use-in-view";

// The nav counts as "over the hero" while the hero still reaches below the nav bar (about 80 px).
const NAV_OVERLAP_MARGIN = "-80px 0px 0px 0px";

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
        !overHero && "bg-background text-foreground border-b-2 border-border",
        open && "z-40",
      )}
    >
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 256 256" fill={overHero ? "#ffd400" : "currentColor"} aria-hidden="true">
          <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
        </svg>
        <span className={cn("text-lg font-display", overHero ? "text-[#ffd400]" : "text-foreground")}>{tHero("brand")}</span>
      </div>

      <div
        className={cn(
          "hidden md:flex absolute left-1/2 -translate-x-1/2 p-1 items-center gap-1",
          overHero ? "bg-black/80 border-2 border-[#ffd400]" : "bg-card border-2 border-border",
        )}
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={
              item.key === ACTIVE_NAV_ITEM
                ? overHero
                  ? "bg-[#ffd400] text-black px-4 py-1.5 font-display text-xs"
                  : "bg-highlight text-highlight-foreground px-4 py-1.5 font-display text-xs"
                : overHero
                  ? "text-white px-4 py-1.5 font-display text-xs hover:bg-white/15 transition-colors"
                  : "text-muted-foreground px-4 py-1.5 font-display text-xs hover:bg-accent hover:text-foreground transition-colors"
            }
          >
            {t(item.key)}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <LocaleSwitch
          className={cn(
            "hidden md:block font-display text-xs",
            overHero ? "text-white hover:text-[#ffd400]" : "text-muted-foreground hover:text-foreground",
          )}
        />
        <a
          href="#waitlist"
          data-umami-event="join-cta"
          data-umami-event-location="nav"
          className={cn(
            "hidden md:block font-display text-xs px-5 py-2.5 border-2 transition-colors",
            overHero
              ? "bg-[#ff261f] text-black border-black hover:bg-[#d91f17]"
              : "bg-primary text-primary-foreground border-border hover:bg-primary/90",
          )}
        >
          {t("join")}
        </a>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden" aria-label={t("menu")}>
            <Menu className={overHero ? "text-[#ffd400]" : "text-foreground"} aria-hidden="true" />
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
                    className="block py-3 font-display text-sm"
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
            <LocaleSwitch className="font-display text-xs" />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
