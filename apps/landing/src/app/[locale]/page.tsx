import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@spot-on-slot/shared";
import { Hero } from "@/components/hero/hero";
import { HeroNav } from "@/components/hero/hero-nav";
import { Audiences } from "@/components/sections/audiences";
import { Faq } from "@/components/sections/faq";
import { Footer } from "@/components/sections/footer";
import { HowItWorks } from "@/components/sections/how-it-works";
import { WaitlistSection } from "@/components/waitlist/waitlist-section";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);

  return (
    <div className="flex flex-1 flex-col">
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
