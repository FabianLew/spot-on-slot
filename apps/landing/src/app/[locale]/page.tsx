import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@spot-on-slot/shared";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("hero");

  return (
    <main className="flex flex-1 flex-col">
      <h1>
        <span className="font-playfair italic">{t("headlineLine1")}</span> {t("headlineLine2")}
      </h1>
    </main>
  );
}
