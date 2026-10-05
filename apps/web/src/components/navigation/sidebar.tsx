import { useTranslations } from "next-intl";
import { NavLink } from "./nav-link";
import { navItems } from "./nav-items";
import { UserMenu } from "./user-menu";

export function Sidebar() {
  const t = useTranslations();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border bg-card p-4 md:flex">
      <span className="px-3 pt-2 text-lg font-bold">{t("common.appName")}</span>
      <nav aria-label={t("nav.primary")} className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} variant="sidebar" />
        ))}
      </nav>
      <UserMenu />
    </aside>
  );
}
