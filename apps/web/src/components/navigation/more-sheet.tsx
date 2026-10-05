"use client";

import { Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@spot-on-slot/ui";
import { LanguageRadioList } from "@/components/preferences/language-menu";
import { ThemeRadioList } from "@/components/preferences/theme-menu";
import { NavLink } from "./nav-link";
import { navItems } from "./nav-items";

export function MoreSheet() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Ellipsis className="size-5" aria-hidden="true" />
        {t("nav.more")}
      </SheetTrigger>
      <SheetContent closeLabel={t("common.close")} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t("nav.more")}</SheetTitle>
        </SheetHeader>
        <ul className="flex flex-col">
          {navItems
            .filter((item) => item.mobile === "more")
            .map((item) => (
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
