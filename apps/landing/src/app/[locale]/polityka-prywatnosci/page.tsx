import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/legal-document";
import { routing } from "@/i18n/routing";
import { absoluteUrl, baseOpenGraph, pageAlternates } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/polityka-prywatnosci">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const title = `${t("title")} | Spot On Slot`;
  return {
    title,
    description: t("metaDescription"),
    alternates: pageAlternates("/polityka-prywatnosci", locale),
    openGraph: { ...baseOpenGraph(locale), title, description: t("metaDescription"), url: absoluteUrl("/polityka-prywatnosci", locale) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/polityka-prywatnosci">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LegalDocument kind="privacy" />;
}
