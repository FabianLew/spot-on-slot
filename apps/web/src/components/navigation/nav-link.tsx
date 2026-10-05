"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@spot-on-slot/ui";
import { isActive } from "./is-active";
import { navIcons } from "./nav-icons";
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
  const Icon = navIcons[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "font-display relative flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant !== "tab" && "gap-3 border-2 px-3 text-sm",
        variant === "sidebar" && "py-2",
        variant === "sheet" && "py-3",
        variant !== "tab" &&
          (active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-transparent hover:border-border hover:bg-accent hover:text-accent-foreground"),
        variant === "tab" && "min-h-14 flex-1 flex-col justify-center gap-1 text-[0.625rem]",
        variant === "tab" && (active ? "text-foreground" : "text-muted-foreground"),
      )}
    >
      <Icon className={cn("size-5", active && variant === "tab" && "text-primary")} aria-hidden="true" />
      {t(item.labelKey)}
      {active && variant === "tab" && (
        <span aria-hidden="true" data-active-indicator className="absolute inset-x-3 top-0 h-1 bg-primary" />
      )}
      {active && variant !== "tab" && <span aria-hidden="true" data-active-indicator className="ml-auto">›</span>}
    </Link>
  );
}
