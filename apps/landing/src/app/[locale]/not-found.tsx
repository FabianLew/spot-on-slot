import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("common");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-2xl">{t("notFoundTitle")}</h1>
      <Link href="/" className="text-primary underline underline-offset-4">
        {t("backHome")}
      </Link>
    </main>
  );
}
