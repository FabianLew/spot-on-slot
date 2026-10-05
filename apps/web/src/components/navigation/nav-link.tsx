"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@spot-on-slot/ui";
import { isActive } from "./is-active";
import type { NavItem } from "./nav-items";

export function NavLink({
  item,
  variant,
  onNavigate,
}: {
  item: NavItem;
  variant: "sidebar" | "tab" | "sheet";
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const active = isActive(usePathname(), item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "sidebar" && "gap-3 rounded-md px-3 py-2 hover:bg-accent",
        variant === "sheet" && "gap-3 rounded-md px-3 py-3 hover:bg-accent",
        variant === "tab" && "min-h-14 flex-1 flex-col justify-center gap-1 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {t(item.labelKey)}
      {active && variant !== "sheet" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bg-primary",
            variant === "sidebar" ? "inset-y-1.5 left-0 w-1 rounded-full" : "inset-x-4 top-0 h-0.5",
          )}
        />
      )}
    </Link>
  );
}
