import { useTranslations } from "next-intl";
import { PrivacyNotice } from "@/components/sections/privacy-notice";
import { getPrivacyConfig } from "@/lib/privacy-config";
import { WaitlistForm } from "./waitlist-form";

export function WaitlistSection() {
  const t = useTranslations("waitlist");
  const { controller, email } = getPrivacyConfig();

  return (
    <section id="waitlist" className="scroll-mt-20 bg-background pattern-grid text-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16 sm:py-24">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl sm:text-3xl">{t("heading")}</h2>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-lg">
          <WaitlistForm />
        </div>
        <PrivacyNotice controller={controller} email={email} />
      </div>
    </section>
  );
}
