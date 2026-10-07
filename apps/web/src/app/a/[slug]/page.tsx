import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArtistProfileView } from "@/components/artist/artist-profile-view";
import { BookingCta } from "@/components/bookings/booking-cta";
import { MessageCta } from "@/components/messages/message-cta";
import { NEXT_FREE_DAYS } from "@/components/calendar/next-free-slots";
import { findPublicArtist, findPublicAvailability } from "@/lib/public-profiles";

// Until the MVP launch public profiles stay out of search engines (spec B4/W3).
const ROBOTS = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const artist = await findPublicArtist((await params).slug);
  if (!artist) return { robots: ROBOTS };
  const t = await getTranslations();
  const genres = artist.genres.map((genre) => t(`genres.${genre}`)).join(", ");
  const description =
    artist.bio?.slice(0, 160) || t("artistProfile.public.description", { name: artist.stageName, genres });
  return {
    title: artist.stageName,
    description,
    robots: ROBOTS,
    openGraph: {
      type: "profile",
      title: artist.stageName,
      description,
      images: artist.avatar
        ? [{ url: artist.avatar.large, width: artist.avatar.width, height: artist.avatar.height }]
        : [],
    },
  };
}

export default async function Page({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const artist = await findPublicArtist(slug);
  if (!artist) notFound();
  const freeTime = await findPublicAvailability(slug, NEXT_FREE_DAYS);
  return (
    <ArtistProfileView
      profile={artist}
      headingLevel={1}
      freeTime={freeTime}
      action={
        <div className="flex flex-wrap gap-2">
          <BookingCta target={{ kind: "artist", slug }} />
          <MessageCta target={{ kind: "artist", slug }} />
        </div>
      }
    />
  );
}
