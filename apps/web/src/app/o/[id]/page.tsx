import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ListingView } from "@/components/listings/listing-view";
import { findPublicListing } from "@/lib/public-profiles";

// Until the MVP launch public pages stay out of search engines (spec B4/W3/W7).
const ROBOTS = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/o/[id]">): Promise<Metadata> {
  const listing = await findPublicListing((await params).id);
  if (!listing) return { robots: ROBOTS };
  const t = await getTranslations();
  const author = listing.artist?.stageName ?? listing.venue?.name ?? "";
  const title = `${t(`listings.kind.${listing.kind}`)}: ${author}`;
  const genres = listing.genres.map((genre) => t(`genres.${genre}`)).join(", ");
  const description = listing.description?.slice(0, 160) || genres;
  return { title, description, robots: ROBOTS, openGraph: { title, description } };
}

export default async function Page({ params }: PageProps<"/o/[id]">) {
  const listing = await findPublicListing((await params).id);
  if (!listing) notFound();
  return <ListingView listing={listing} />;
}
