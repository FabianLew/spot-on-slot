"use client";

import { Logout } from "pixelarticons/react/Logout";
import { MoreHorizontal } from "pixelarticons/react/MoreHorizontal";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, cn, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@spot-on-slot/ui";
import { LanguageRadioList } from "@/components/preferences/language-menu";
import { ThemeRadioList } from "@/components/preferences/theme-menu";
import { useSession } from "@/components/session/session-provider";
import { isActive } from "./is-active";
import { NavLink } from "./nav-link";
import { navItems } from "./nav-items";

export function MoreSheet() {
  const t = useTranslations();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const moreItems = navItems.filter((item) => item.mobile === "more");
  // The trigger stands in for the sections inside the sheet, so it looks active on any of them.
  const active = moreItems.some((item) => isActive(pathname, item.href));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "font-display relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.625rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <MoreHorizontal className={cn("size-5", active && "text-primary")} aria-hidden="true" />
        {t("nav.more")}
        {active && (
          <span aria-hidden="true" data-active-indicator className="absolute inset-x-3 top-0 h-1 bg-primary" />
        )}
      </SheetTrigger>
      <SheetContent className="border-t-2" closeLabel={t("common.close")} aria-describedby={undefined}>
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
        <Button variant="outline" className="justify-start gap-3" onClick={() => void signOut()}>
          <Logout className="size-5" aria-hidden="true" />
          {t("auth.logout")}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
