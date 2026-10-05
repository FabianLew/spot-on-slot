import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel } from "@spot-on-slot/ui";
import { LocationDemo } from "@/components/design/location-demo";
import { ScreenHeader } from "@/components/design/screen-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design.screens");
  return { title: t("location") };
}

export default async function Page() {
  const t = await getTranslations("design");
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t("screens.location")} />
      <Panel>
        <p className="text-sm">{t("location.intro")}</p>
      </Panel>
      <LocationDemo />
    </section>
  );
}
