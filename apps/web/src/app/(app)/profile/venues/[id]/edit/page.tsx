import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VenueEditor } from "@/components/venue/venue-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("venueProfile.edit");
  return { title: t("title") };
}

export default async function Page({ params }: PageProps<"/profile/venues/[id]/edit">) {
  return <VenueEditor id={(await params).id} />;
}
