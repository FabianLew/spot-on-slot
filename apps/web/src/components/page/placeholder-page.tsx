import { useTranslations } from "next-intl";
import { PageHeader, Panel, PixelSquare } from "@spot-on-slot/ui";
import type { NavKey } from "@/components/navigation/nav-items";

export function PlaceholderPage({ titleKey }: { titleKey: NavKey }) {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t(`nav.${titleKey}`)} />
      <Panel>
        <p className="flex items-center gap-3 text-sm uppercase">
          <PixelSquare className="size-4 shrink-0 text-primary" />
          {t("pages.placeholder")}
        </p>
      </Panel>
    </section>
  );
}
