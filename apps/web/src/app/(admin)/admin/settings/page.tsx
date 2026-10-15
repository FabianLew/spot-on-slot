import { useTranslations } from "next-intl";
import { PageHeader, Panel } from "@spot-on-slot/ui";
import { AccountSettings } from "@/components/account/account-settings";
import { navMetadata } from "@/lib/nav-metadata";
import { SettingsForm } from "../../../(app)/settings/settings-form";

/** An admin's own account: e-mail, password, export and appearance; admin accounts are not deleted by themselves. */
export default function Page() {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("settings.title")} />
      <AccountSettings deletable={false}>
        <Panel title={t("settings.appearance")}>
          <p className="text-sm text-muted-foreground">{t("settings.description")}</p>
          <SettingsForm />
        </Panel>
      </AccountSettings>
    </section>
  );
}

export const generateMetadata = () => navMetadata("settings");
