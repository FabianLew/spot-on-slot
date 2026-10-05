import { useTranslations } from "next-intl";
import type { NavKey } from "@/components/navigation/nav-items";

export function PlaceholderPage({ titleKey }: { titleKey: NavKey }) {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">{t(`nav.${titleKey}`)}</h1>
      <p className="text-muted-foreground">{t("pages.placeholder")}</p>
    </section>
  );
}
