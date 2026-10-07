import { useTranslations } from "next-intl";
import { PageHeader, Panel } from "@spot-on-slot/ui";
import { TermsNotice } from "@/components/account/account-gate";
import { AccountSettings } from "@/components/account/account-settings";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { navMetadata } from "@/lib/nav-metadata";
import { SettingsForm } from "./settings-form";

export default function Page() {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("settings.title")} />
      <TermsNotice />
      <AccountSettings>
        <Panel title={t("settings.appearance")}>
          <p className="text-sm text-muted-foreground">{t("settings.description")}</p>
          <SettingsForm />
        </Panel>
        <NotificationSettings />
      </AccountSettings>
    </section>
  );
}

export const generateMetadata = () => navMetadata("settings");
