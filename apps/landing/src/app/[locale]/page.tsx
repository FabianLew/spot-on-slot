import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@spot-on-slot/shared";
import { Hero } from "@/components/hero/hero";
import { HeroNav } from "@/components/hero/hero-nav";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);

  return (
    <main className="flex flex-1 flex-col">
      <HeroNav />
      <Hero />
    </main>
  );
}
