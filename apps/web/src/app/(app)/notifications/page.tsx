import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@spot-on-slot/ui";
import { NotificationList } from "@/components/notifications/notification-list";

export default function Page() {
  const t = useTranslations("notifications");
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <NotificationList />
      <Link href="/settings#notifications" className="text-sm underline">
        {t("settingsLink")}
      </Link>
    </section>
  );
}

export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}
