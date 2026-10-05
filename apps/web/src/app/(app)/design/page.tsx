import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionTile, PageHeader, Panel, PixelBlob, PixelHeadphones, PixelNote, PixelSquare } from "@spot-on-slot/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("design");
  const screens = [
    { href: "/design/role", label: t("screens.role"), icon: <PixelSquare className="size-6 text-primary" /> },
    { href: "/design/dj-profile", label: t("screens.djProfile"), icon: <PixelHeadphones className="size-7 text-primary" /> },
    { href: "/design/book-dj", label: t("screens.bookDj"), icon: <PixelNote className="size-7 text-primary" /> },
    { href: "/design/venue-panel", label: t("screens.venuePanel"), icon: <PixelBlob className="size-7 text-primary" /> },
  ];
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      <Panel>
        <p className="text-sm">{t("intro")}</p>
      </Panel>
      <ul className="grid gap-3 sm:grid-cols-2">
        {screens.map((screen) => (
          <li key={screen.href}>
            <ActionTile asChild icon={screen.icon} className="w-full">
              <Link href={screen.href}>{screen.label}</Link>
            </ActionTile>
          </li>
        ))}
      </ul>
    </section>
  );
}
