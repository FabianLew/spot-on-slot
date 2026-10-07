import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ConfirmStatus } from "@/components/waitlist/confirm-status";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/waitlist/confirm">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "confirm" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ConfirmPage({ params, searchParams }: PageProps<"/[locale]/waitlist/confirm">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background pattern-grid px-6 text-foreground">
      <div className="w-full max-w-md border-2 border-border bg-card p-6 shadow-lg">
        <ConfirmStatus token={typeof token === "string" && token ? token : null} />
      </div>
    </main>
  );
}
