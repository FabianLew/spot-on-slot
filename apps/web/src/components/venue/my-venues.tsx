"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Panel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { storeVenue, useMyVenues } from "@/components/onboarding/queries";
import { StatusBar } from "@/components/profile/status-bar";
import { api } from "@/lib/api";
import { VenueProfileView } from "./venue-profile-view";

/** The backend's limit of venue teams per account (`Venue.MAX_PER_USER`). */
export const MAX_VENUES = 10;

/** The "Profil" tab of a venue account: one venue (picked by `?venue=`, else the oldest) with its state and actions. */
export function MyVenues({ venueId }: { venueId?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const venues = useMyVenues();

  const toggle = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const params = { path: { id } };
      return unwrap(
        publish
          ? await api.POST("/api/v1/venues/{id}/publish", { params })
          : await api.POST("/api/v1/venues/{id}/unpublish", { params }),
      );
    },
    onSuccess: (saved) => {
      storeVenue(queryClient, saved);
      toast.success(t(saved.published ? "venueProfile.mine.publishedToast" : "venueProfile.mine.unpublishedToast"));
    },
  });

  if (venues.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (venues.isError) return <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />;
  const list = venues.data;
  if (list.length === 0) {
    return (
      <Panel>
        <p className="text-sm">{t("venueProfile.mine.none")}</p>
        <Button asChild className="self-start">
          <Link href="/onboarding">{t("venueProfile.mine.add")}</Link>
        </Button>
      </Panel>
    );
  }

  const venue = list.find((item) => item.id === venueId) ?? list[0];
  const owner = venue.role === "OWNER";
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        {list.length > 1 && (
          <div className="flex min-w-56 flex-col gap-2">
            <label htmlFor="venue-switch" className="text-sm font-bold uppercase">
              {t("venueProfile.mine.switch")}
            </label>
            <Select value={venue.id} onValueChange={(id) => router.replace(`/profile?venue=${id}`)}>
              <SelectTrigger id="venue-switch" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {list.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {list.length < MAX_VENUES ? (
          <Button asChild variant="outline">
            <Link href="/onboarding?new=venue">{t("venueProfile.mine.add")}</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("venueProfile.mine.limit")}</p>
        )}
      </div>
      <StatusBar
        published={venue.published}
        missing={venue.missingForPublication}
        publicPath={`/v/${venue.slug}`}
        draftText={t("venueProfile.mine.draft")}
        publishedText={t("venueProfile.mine.published")}
        edit={{ href: `/profile/venues/${venue.id}/edit`, label: t("venueProfile.mine.edit") }}
        onToggle={(publish) => toggle.mutate({ id: venue.id, publish })}
        toggling={toggle.isPending}
        canToggle={owner}
      >
        <Button asChild variant="outline">
          <Link href={`/profile/venues/${venue.id}/team`}>{t("venueProfile.mine.team")}</Link>
        </Button>
      </StatusBar>
      <p className="text-xs uppercase text-muted-foreground">
        {t("venueProfile.mine.yourRole", { role: t(`venueProfile.role.${venue.role}`) })}
      </p>
      <VenueProfileView venue={venue} />
    </>
  );
}
