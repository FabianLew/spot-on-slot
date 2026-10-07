import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MessageCta } from "@/components/messages/message-cta";
import { VenueProfileView } from "@/components/venue/venue-profile-view";
import { findPublicVenue } from "@/lib/public-profiles";

// Until the MVP launch public profiles stay out of search engines (spec W3/W4).
const ROBOTS = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/v/[slug]">): Promise<Metadata> {
  const venue = await findPublicVenue((await params).slug);
  if (!venue) return { robots: ROBOTS };
  const t = await getTranslations();
  const description =
    venue.description?.slice(0, 160) ||
    t("venueProfile.public.description", {
      name: venue.name,
      type: t(`venueTypes.${venue.type}`),
      city: venue.address.city,
    });
  return {
    title: venue.name,
    description,
    robots: ROBOTS,
    openGraph: {
      type: "website",
      title: venue.name,
      description,
      images: venue.avatar ? [{ url: venue.avatar.large, width: venue.avatar.width, height: venue.avatar.height }] : [],
    },
  };
}

export default async function Page({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const venue = await findPublicVenue(slug);
  if (!venue) notFound();
  return (
    <VenueProfileView
      venue={venue}
      headingLevel={1}
      action={<MessageCta target={{ kind: "venue", slug }} className="self-start" />}
    />
  );
}
