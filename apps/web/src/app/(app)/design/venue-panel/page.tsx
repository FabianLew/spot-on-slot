import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  ActionTile,
  Panel,
  PixelBlob,
  PixelHeadphones,
  PixelNote,
  PixelSquare,
  SectionTitle,
  StatTile,
} from "@spot-on-slot/ui";
import { GenreTags } from "@/components/design/dj-card";
import { sampleVenue } from "@/components/design/sample-data";
import { ScreenHeader } from "@/components/design/screen-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design.screens");
  return { title: t("venuePanel") };
}

const iconClass = "h-6 w-auto text-primary";

export default async function Page() {
  const t = await getTranslations("design");
  const format = await getFormatter();
  const day = (iso: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "short" });
  const time = (iso: string) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" });
  const nextSlot = sampleVenue.openSlots[0];

  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t("screens.venuePanel")} />
      <Panel>
        <h2 className="font-display text-3xl leading-none">{sampleVenue.name}</h2>
        <div className="flex flex-col gap-1 text-xs uppercase">
          <p>{sampleVenue.city}</p>
          <p>{t("venue.capacity", { capacity: sampleVenue.capacity, floors: sampleVenue.floors })}</p>
        </div>
        <GenreTags genres={sampleVenue.genres} />
      </Panel>

      <div className="flex flex-col gap-3">
        <SectionTitle>{t("venue.today")}</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={<PixelHeadphones className={iconClass} />} label={t("venue.djsNearby")} value={sampleVenue.djsNearby} />
          <StatTile
            icon={<PixelSquare className={iconClass} />}
            label={t("venue.openRequests")}
            value={String(sampleVenue.openRequests).padStart(2, "0")}
          />
          <StatTile icon={<PixelNote className={iconClass} />} label={t("venue.nextOpenSlot")} value={day(nextSlot.startsAt)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-3">
          <SectionTitle>{t("venue.openSlots")}</SectionTitle>
          <ul className="flex flex-col gap-3">
            {sampleVenue.openSlots.map((slot) => (
              <li
                key={slot.startsAt}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 border-2 border-border bg-card px-3 py-4"
              >
                <span className="font-display text-sm">{day(slot.startsAt)}</span>
                <span className="text-[0.6875rem] uppercase">
                  {`${time(slot.startsAt)} // ${t(`venue.rooms.${slot.room}`)}`}
                </span>
                <span aria-hidden="true" className="font-display text-primary">
                  ›
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <SectionTitle>{t("venue.quickActions")}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <ActionTile asChild icon={<PixelNote className={iconClass} />}>
              <Link href="/listings?add=1">{t("venue.postOpenSlot")}</Link>
            </ActionTile>
            <ActionTile asChild icon={<PixelSquare className={iconClass} />}>
              <Link href="/messages">{t("venue.inbox")}</Link>
            </ActionTile>
            <ActionTile asChild icon={<PixelBlob className={iconClass} />}>
              <Link href="/search">{t("venue.radar")}</Link>
            </ActionTile>
            <ActionTile asChild icon={<PixelHeadphones className={iconClass} />}>
              <Link href="/profile">{t("venue.profile")}</Link>
            </ActionTile>
          </div>
        </div>
      </div>

      <Panel title={t("venue.tonight")}>
        <p className="flex items-center gap-3 text-[0.6875rem] uppercase">
          <PixelBlob className="h-6 w-auto shrink-0 text-primary" />
          {t("venue.liveStatus", sampleVenue.live)}
        </p>
      </Panel>
    </section>
  );
}
