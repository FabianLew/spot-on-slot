import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { NavLink } from "./nav-link";
import { navItems } from "./nav-items";
import { UserMenu } from "./user-menu";

/**
 * Desktop navigation, pinned to the viewport: it never scrolls with the page and always fills the screen height (it
 * scrolls on its own only on very short windows). The spacer keeps its width in the layout and paints the column down
 * to the end of long pages.
 */
export function Sidebar() {
  const t = useTranslations();
  return (
    <>
      <div aria-hidden="true" className="hidden w-64 shrink-0 border-r-2 border-border bg-card md:block" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto border-r-2 border-border bg-card p-4 md:flex">
        <Logo label={t("common.appName")} className="px-1 pt-2" />
        <div aria-hidden="true" className="pattern-checker h-3 text-primary" />
        <nav aria-label={t("nav.primary")} className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} variant="sidebar" />
          ))}
        </nav>
        <UserMenu />
      </aside>
    </>
  );
}
