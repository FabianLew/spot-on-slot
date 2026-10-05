import { useTranslations } from "next-intl";
import { navMetadata } from "@/lib/nav-metadata";
import { SettingsForm } from "./settings-form";

export default function Page() {
  const t = useTranslations();
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.description")}</p>
      </div>
      <SettingsForm />
    </section>
  );
}

export const generateMetadata = () => navMetadata("settings");
