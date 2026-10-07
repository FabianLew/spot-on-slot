import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@spot-on-slot/shared";
import { Hero } from "@/components/hero/hero";
import { HeroNav } from "@/components/hero/hero-nav";
import { Audiences } from "@/components/sections/audiences";
import { Faq } from "@/components/sections/faq";
import { Footer } from "@/components/sections/footer";
import { HowItWorks } from "@/components/sections/how-it-works";
import { WaitlistSection } from "@/components/waitlist/waitlist-section";
import { absoluteUrl, baseOpenGraph, pageAlternates, siteUrl } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    alternates: pageAlternates("/", locale),
    openGraph: { ...baseOpenGraph(locale), title: t("title"), description: t("description"), url: absoluteUrl("/", locale) },
  };
}

async function StructuredData({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "meta" });
  const organization = { "@type": "Organization", "@id": `${siteUrl()}/#organization`, name: "Spot On Slot", url: siteUrl() };
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": `${siteUrl()}/#website`,
        name: "Spot On Slot",
        url: absoluteUrl("/", locale),
        description: t("description"),
        inLanguage: locale,
        publisher: { "@id": organization["@id"] },
      },
    ],
  };
  // `<` is escaped so text from the messages can never close the script tag.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData locale={locale as Locale} />
      <HeroNav />
      <Hero />
      <main>
        <Audiences />
        <HowItWorks />
        <WaitlistSection />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
