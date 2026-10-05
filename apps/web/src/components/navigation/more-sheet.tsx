"use client";

import { Ellipsis } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@spot-on-slot/ui";
import { LanguageRadioList } from "@/components/preferences/language-menu";
import { ThemeRadioList } from "@/components/preferences/theme-menu";
import { isActive } from "./is-active";
import { NavLink } from "./nav-link";
import { navItems } from "./nav-items";

export function MoreSheet() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const moreItems = navItems.filter((item) => item.mobile === "more");
  // The trigger stands in for the sections inside the sheet, so it looks active on any of them.
  const active = moreItems.some((item) => isActive(pathname, item.href));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Ellipsis className="size-5" aria-hidden="true" />
        {t("nav.more")}
        {active && (
          <span aria-hidden="true" data-active-indicator className="absolute inset-x-4 top-0 h-0.5 bg-primary" />
        )}
      </SheetTrigger>
      <SheetContent closeLabel={t("common.close")} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t("nav.more")}</SheetTitle>
        </SheetHeader>
        <ul className="flex flex-col">
          {moreItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} variant="sheet" onNavigate={() => setOpen(false)} />
            </li>
          ))}
        </ul>
        <LanguageRadioList />
        <ThemeRadioList />
      </SheetContent>
    </Sheet>
  );
}
