"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActive } from "./is-active";
import { navItems } from "./nav-items";

export function TopBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const current = navItems.find((item) => isActive(pathname, item.href));
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-card px-4 md:hidden">
      <span className="text-base font-semibold">
        {current ? t(`nav.${current.labelKey}`) : t("common.appName")}
      </span>
    </header>
  );
}
