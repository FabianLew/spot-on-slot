import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default function Page() {
  return <OnboardingScreen />;
}
