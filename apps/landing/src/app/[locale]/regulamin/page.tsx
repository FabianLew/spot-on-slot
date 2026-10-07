import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/legal-document";
import { routing } from "@/i18n/routing";
import { absoluteUrl, baseOpenGraph, pageAlternates } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/regulamin">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const title = `${t("title")} | Spot On Slot`;
  return {
    title,
    description: t("metaDescription"),
    alternates: pageAlternates("/regulamin", locale),
    openGraph: { ...baseOpenGraph(locale), title, description: t("metaDescription"), url: absoluteUrl("/regulamin", locale) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/regulamin">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LegalDocument kind="terms" />;
}
