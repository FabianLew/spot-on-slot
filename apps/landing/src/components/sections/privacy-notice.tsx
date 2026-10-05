import { useTranslations } from "next-intl";

export type PrivacyNoticeProps = {
  controller: string;
  email: string;
};

export function PrivacyNotice({ controller, email }: PrivacyNoticeProps) {
  const t = useTranslations("privacy");

  return <p className="text-xs text-muted-foreground">{t("clause", { administrator: controller, contact: email })}</p>;
}
