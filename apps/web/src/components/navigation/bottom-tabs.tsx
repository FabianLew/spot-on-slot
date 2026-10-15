import { useTranslations } from "next-intl";
import { MoreSheet } from "./more-sheet";
import { NavLink } from "./nav-link";
import { navItems, type NavItem } from "./nav-items";

export function BottomTabs({ items = navItems }: { items?: readonly NavItem[] }) {
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("primary")}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items
        .filter((item) => item.mobile === "tab")
        .map((item) => (
          <NavLink key={item.href} item={item} variant="tab" />
        ))}
      <MoreSheet items={items} />
    </nav>
  );
}
