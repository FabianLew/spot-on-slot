import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VenueTeam } from "@/components/venue/venue-team";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("venueProfile.team");
  return { title: t("title") };
}

export default async function Page({ params }: PageProps<"/profile/venues/[id]/team">) {
  return <VenueTeam id={(await params).id} />;
}
