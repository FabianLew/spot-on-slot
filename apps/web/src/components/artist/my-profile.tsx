"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel, toast } from "@spot-on-slot/ui";
import { NEXT_FREE_DAYS } from "@/components/calendar/next-free-slots";
import { useCalendar } from "@/components/calendar/queries";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { ARTIST_PROFILE, useArtistProfile } from "@/components/onboarding/queries";
import { StatusBar } from "@/components/profile/status-bar";
import { useSession } from "@/components/session/session-provider";
import { MyVenues } from "@/components/venue/my-venues";
import { api } from "@/lib/api";
import { ArtistProfileView } from "./artist-profile-view";

/** The "Profil" tab: the profile as others see it (artist, or one of the account's venues), with its state and actions. */
export function MyProfile({ venueId }: { venueId?: string } = {}) {
  const t = useTranslations("artistProfile.mine");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      {role === "ARTIST" ? (
        <ArtistSection />
      ) : role === "VENUE" ? (
        <MyVenues venueId={venueId} />
      ) : (
        <Panel>
          <p className="text-sm">{t("other")}</p>
        </Panel>
      )}
    </section>
  );
}

function ArtistSection() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const profile = useArtistProfile();
  const [range] = useState(() => {
    const now = new Date();
    return { from: now, to: new Date(now.getTime() + NEXT_FREE_DAYS * 86_400_000) };
  });
  const freeTime = useCalendar(range.from, range.to, profile.data != null);

  const toggle = useMutation({
    mutationFn: async (publish: boolean) =>
      unwrap(publish ? await api.POST("/api/v1/artists/me/publish") : await api.POST("/api/v1/artists/me/unpublish")),
    onSuccess: (saved) => {
      queryClient.setQueryData(ARTIST_PROFILE, saved);
      toast.success(t(saved.published ? "artistProfile.mine.publishedToast" : "artistProfile.mine.unpublishedToast"));
    },
  });

  if (profile.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  const data = profile.data;
  if (!data) {
    return (
      <Panel>
        <p className="text-sm">{t("artistProfile.mine.none")}</p>
        <Button asChild className="self-start">
          <Link href="/onboarding">{t("artistProfile.mine.start")}</Link>
        </Button>
      </Panel>
    );
  }

  return (
    <>
      <StatusBar
        published={data.published}
        missing={data.missingForPublication}
        publicPath={`/a/${data.slug}`}
        draftText={t("artistProfile.mine.draft")}
        publishedText={t("artistProfile.mine.published")}
        edit={{ href: "/profile/edit", label: t("artistProfile.mine.edit") }}
        onToggle={(publish) => toggle.mutate(publish)}
        toggling={toggle.isPending}
      />
      <ArtistProfileView profile={data} freeTime={freeTime.data} />
    </>
  );
}
