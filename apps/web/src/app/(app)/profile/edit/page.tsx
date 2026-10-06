import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileEditor } from "@/components/artist/profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("artistProfile.edit");
  return { title: t("title") };
}

export default function Page() {
  return <ProfileEditor />;
}
