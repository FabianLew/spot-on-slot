import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { NavLink } from "./nav-link";
import { navItems } from "./nav-items";
import { UserMenu } from "./user-menu";

export function Sidebar() {
  const t = useTranslations();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r-2 border-border bg-card p-4 md:flex">
      <Logo label={t("common.appName")} className="px-1 pt-2" />
      <div aria-hidden="true" className="pattern-checker h-3 text-primary" />
      <nav aria-label={t("nav.primary")} className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} variant="sidebar" />
        ))}
      </nav>
      <UserMenu />
    </aside>
  );
}
