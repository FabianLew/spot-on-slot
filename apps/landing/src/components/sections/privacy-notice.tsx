import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type PrivacyNoticeProps = {
  controller: string;
  email: string;
};

export function PrivacyNotice({ controller, email }: PrivacyNoticeProps) {
  const t = useTranslations("privacy");

  return (
    <p className="text-xs text-muted-foreground">
      {t("clause", { administrator: controller, contact: email })}{" "}
      <Link href="/polityka-prywatnosci" target="_blank" className="underline underline-offset-2 hover:text-foreground">
        {t("policyLink")}
      </Link>
    </p>
  );
}
