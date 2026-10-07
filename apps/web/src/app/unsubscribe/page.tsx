import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UnsubscribeCard } from "@/components/notifications/unsubscribe-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications.unsubscribe");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The link from alert e-mails; a button, not the visit, switches e-mails off (mail scanners open links). */
export default async function Page({ searchParams }: PageProps<"/unsubscribe">) {
  const token = (await searchParams).token;
  return <UnsubscribeCard token={typeof token === "string" ? token : null} />;
}
