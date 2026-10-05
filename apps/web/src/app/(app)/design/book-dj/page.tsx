import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel } from "@spot-on-slot/ui";
import { CityLine, DjAvatar, GenreTags } from "@/components/design/dj-card";
import { sampleDj } from "@/components/design/sample-data";
import { ScreenHeader } from "@/components/design/screen-header";
import { BookingForm } from "./booking-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design.screens");
  return { title: t("bookDj") };
}

export default async function Page() {
  const t = await getTranslations("design");
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t("screens.bookDj")} />
      <Panel className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-4">
        <DjAvatar className="border-0" />
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl leading-none">{sampleDj.name}</h2>
          <CityLine city={sampleDj.city} />
          <GenreTags genres={sampleDj.genres} />
        </div>
      </Panel>
      <BookingForm openDates={sampleDj.openDates} />
    </section>
  );
}
