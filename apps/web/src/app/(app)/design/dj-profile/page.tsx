import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, buttonVariants, cn, Panel, SkillMeter } from "@spot-on-slot/ui";
import { CityLine, DjAvatar, GenreTags } from "@/components/design/dj-card";
import { sampleDj } from "@/components/design/sample-data";
import { ScreenHeader } from "@/components/design/screen-header";
import { SlotPicker } from "@/components/design/slot-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design.screens");
  return { title: t("djProfile") };
}

export default async function Page() {
  const t = await getTranslations("design");
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t("screens.djProfile")} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
        <Panel className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start md:grid-cols-1">
          <DjAvatar />
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-xl leading-none sm:text-3xl md:text-4xl">{sampleDj.name}</h2>
            <p className="text-xs uppercase">{t("profile.roles")}</p>
            <CityLine city={sampleDj.city} extra={t("profile.radius", { km: sampleDj.radiusKm })} />
            <GenreTags genres={sampleDj.genres} />
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel aria-label={t("profile.skills")}>
            <div className="flex flex-col gap-3">
              {sampleDj.skills.map((skill) => (
                <SkillMeter key={skill.key} label={t(`profile.skill.${skill.key}`)} value={skill.value} />
              ))}
            </div>
          </Panel>
          <Panel title={t("profile.about")}>
            <p className="text-xs uppercase leading-relaxed">{t("profile.aboutText")}</p>
          </Panel>
          <Panel title={t("profile.location")}>
            <div className="flex items-center justify-between gap-3">
              <CityLine city={sampleDj.city} />
              <Button size="sm" className="min-w-24 text-xs">
                {t("profile.change")}
              </Button>
            </div>
          </Panel>
          <Panel title={t("profile.nextSlots")}>
            <SlotPicker days={sampleDj.openDates} initial={sampleDj.openDates[1]} />
          </Panel>
          <Link href="/design/book-dj" className={cn(buttonVariants({ size: "lg" }), "h-14 justify-between text-lg")}>
            <span className="flex-1 text-center">{t("profile.bookNow")}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
