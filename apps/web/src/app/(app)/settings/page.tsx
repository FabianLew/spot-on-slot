import { useTranslations } from "next-intl";
import { PageHeader, Panel } from "@spot-on-slot/ui";
import { navMetadata } from "@/lib/nav-metadata";
import { SettingsForm } from "./settings-form";

export default function Page() {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("settings.title")} />
      <Panel>
        <p className="text-sm text-muted-foreground">{t("settings.description")}</p>
        <SettingsForm />
      </Panel>
    </section>
  );
}

export const generateMetadata = () => navMetadata("settings");
