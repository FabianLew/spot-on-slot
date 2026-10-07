"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@spot-on-slot/ui";
import { isActive } from "./is-active";
import { useNavBadge, type NavBadge } from "./nav-badges";
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
  const badge = useNavBadge(item.badge);
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
      {badge && (
        <BadgeCount
          badge={badge}
          className={cn(
            variant === "tab" ? "absolute top-1.5 left-1/2 ml-1" : "ml-auto",
            active && variant !== "tab" && "border-primary-foreground bg-primary-foreground text-primary",
          )}
        />
      )}
      {active && variant === "tab" && (
        <span aria-hidden="true" data-active-indicator className="absolute inset-x-3 top-0 h-1 bg-primary" />
      )}
      {active && variant !== "tab" && (
        <span aria-hidden="true" data-active-indicator className={badge ? undefined : "ml-auto"}>
          ›
        </span>
      )}
    </Link>
  );
}

/** The count, with its full meaning for screen readers ("2 bookingi czekają na Ciebie"). */
export function BadgeCount({ badge, className }: { badge: NavBadge; className?: string }) {
  return (
    <span
      data-badge
      className={cn(
        "inline-flex min-w-5 items-center justify-center border-2 border-primary bg-primary px-1 font-sans text-[0.625rem] font-bold leading-4 text-primary-foreground tabular-nums",
        className,
      )}
    >
      <span aria-hidden="true">{badge.count > 99 ? "99+" : badge.count}</span>
      <span className="sr-only">{`: ${badge.label}`}</span>
    </span>
  );
}
