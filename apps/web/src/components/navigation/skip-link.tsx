import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("nav");
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
    >
      {t("skipToContent")}
    </a>
  );
}
