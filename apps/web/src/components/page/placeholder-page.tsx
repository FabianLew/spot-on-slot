import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PageHeader, Panel, PixelSquare } from "@spot-on-slot/ui";
import type { NavKey } from "@/components/navigation/nav-items";

/** A section that is not built yet; {@code children} go between the header and the notice. */
export function PlaceholderPage({ titleKey, children }: { titleKey: NavKey; children?: ReactNode }) {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t(`nav.${titleKey}`)} />
      {children}
      <Panel>
        <p className="flex items-center gap-3 text-sm uppercase">
          <PixelSquare className="size-4 shrink-0 text-primary" />
          {t("pages.placeholder")}
        </p>
      </Panel>
    </section>
  );
}
