"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { isActive } from "./is-active";
import { navItems, type NavItem } from "./nav-items";

export function TopBar({ items = navItems, bell = true }: { items?: readonly NavItem[]; bell?: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();
  const current = items.find((item) => isActive(pathname, item.href));
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b-2 border-border bg-card px-4 md:hidden">
      <span className="font-display text-base">
        {current
          ? t(`nav.${current.labelKey}`)
          : isActive(pathname, "/notifications")
            ? t("notifications.title")
            : t("common.appName")}
      </span>
      {bell && <NotificationBell variant="link" />}
    </header>
  );
}
