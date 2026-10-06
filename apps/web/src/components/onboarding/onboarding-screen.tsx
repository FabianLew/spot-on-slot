"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@spot-on-slot/ui";
import { useSession } from "@/components/session/session-provider";
import { ArtistWizard } from "./artist-wizard";
import { skipOnboarding } from "./skip";
import { VenueWizard } from "./venue-wizard";

/**
 * The wizard for the signed-in role, with "later" that remembers the choice in this browser. With `newVenue` a venue
 * account adds another venue, and leaving goes back to the profile.
 */
export function OnboardingScreen({ newVenue = false }: { newVenue?: boolean }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { session } = useSession();
  if (session.status !== "authenticated") return null;
  const { user } = session;

  if (user.role !== "ARTIST" && user.role !== "VENUE") {
    return (
      <Panel title={t("otherRole.title")}>
        <p className="text-sm">{t("otherRole.body")}</p>
        <Button asChild className="self-start">
          <Link href="/dashboard">{t("otherRole.toDashboard")}</Link>
        </Button>
      </Panel>
    );
  }

  const adding = newVenue && user.role === "VENUE";
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl text-heading sm:text-3xl">{t(adding ? "titleNew" : "title")}</h1>
        {adding ? (
          <Button type="button" variant="ghost" onClick={() => router.push("/profile")}>
            {t("cancelNew")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              skipOnboarding(user.id);
              router.push("/dashboard");
            }}
          >
            {t("skip")}
          </Button>
        )}
      </div>
      {user.role === "ARTIST" ? <ArtistWizard /> : <VenueWizard fresh={adding} />}
    </section>
  );
}
