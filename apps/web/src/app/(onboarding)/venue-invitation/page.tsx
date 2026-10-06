import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InvitationAccept } from "@/components/venue/invitation-accept";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("venueProfile.invitation");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Outside the (app) group on purpose: an invited person may have no venue yet, and the wizard must not catch them.
export default async function Page({ searchParams }: PageProps<"/venue-invitation">) {
  const { token } = await searchParams;
  return <InvitationAccept token={typeof token === "string" && token ? token : undefined} />;
}
