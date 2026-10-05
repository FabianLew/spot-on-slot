import { useTranslations } from "next-intl";
import { PrivacyNotice } from "@/components/sections/privacy-notice";
import { getPrivacyConfig } from "@/lib/privacy-config";
import { WaitlistForm } from "./waitlist-form";

export function WaitlistSection() {
  const t = useTranslations("waitlist");
  const { controller, email } = getPrivacyConfig();

  return (
    <section id="waitlist" className="scroll-mt-20 bg-background text-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16 sm:py-24">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <WaitlistForm />
        <PrivacyNotice controller={controller} email={email} />
      </div>
    </section>
  );
}
