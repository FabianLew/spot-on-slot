"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useArtistProfile, useMyVenues } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { ListingCard } from "./listing-card";
import { ListingDialog, type ListingAuthor, type ListingDialogTarget } from "./listing-dialog";
import { LISTINGS, useOwnListings, type Listing, type ListingScope } from "./queries";

/** The "Ogłoszenia" tab: an artist's "Jestem wolny" or a venue's "Szukam artysty" listings. */
export function ListingsScreen({ venueId, add = false }: { venueId?: string; add?: boolean }) {
  const t = useTranslations("listings");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      {role === "ARTIST" ? (
        <ArtistListings add={add} />
      ) : role === "VENUE" ? (
        <VenueListings venueId={venueId} add={add} />
      ) : (
        <Panel>
          <p className="text-sm">{t("otherRole")}</p>
        </Panel>
      )}
    </section>
  );
}

function ArtistListings({ add }: { add: boolean }) {
  const t = useTranslations();
  const profile = useArtistProfile();
  if (profile.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  const data = profile.data;
  if (!data?.published) {
    return (
      <NotPublished
        text={t("listings.artistNotPublished")}
        missing={data?.missingForPublication ?? []}
        href={data ? "/profile" : "/onboarding"}
      />
    );
  }
  return (
    <ListingsBody
      author={{
        kind: "ARTIST_AVAILABLE",
        genres: data.genres,
        priceFrom: data.rate?.from,
        priceTo: data.rate?.to,
        travelRadiusKm: data.travelRadiusKm,
      }}
      add={add}
    />
  );
}

function VenueListings({ venueId, add }: { venueId?: string; add: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const venues = useMyVenues();
  if (venues.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (venues.isError) return <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />;
  const list = venues.data;
  if (list.length === 0) return <NotPublished text={t("listings.noVenue")} missing={[]} href="/onboarding" />;
  const venue = list.find((item) => item.id === venueId) ?? list[0];

  return (
    <>
      {list.length > 1 && (
        <div className="flex min-w-56 flex-col gap-2 self-start">
          <label htmlFor="listing-venue-switch" className="text-sm font-bold uppercase">
            {t("venueProfile.mine.switch")}
          </label>
          <Select value={venue.id} onValueChange={(id) => router.replace(`/listings?venue=${id}`)}>
            <SelectTrigger id="listing-venue-switch" className="w-full">
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
      {venue.published ? (
        <ListingsBody
          key={venue.id}
          author={{ kind: "VENUE_SEEKING", venueId: venue.id, genres: venue.genres }}
          add={add}
        />
      ) : (
        <NotPublished
          text={t("listings.venueNotPublished", { name: venue.name })}
          missing={venue.missingForPublication}
          href={`/profile?venue=${venue.id}`}
        />
      )}
    </>
  );
}

function NotPublished({ text, missing, href }: { text: string; missing: string[]; href: string }) {
  const t = useTranslations();
  return (
    <Panel className="border-primary">
      <p className="text-sm">{text}</p>
      {missing.length > 0 && (
        <p className="text-sm">
          {t("profileStatus.missingTitle")}{" "}
          {missing.map((item) => t(`onboarding.missing.${item}` as Parameters<typeof t>[0])).join(", ")}
        </p>
      )}
      <Button asChild className="self-start">
        <Link href={href}>{t("listings.goProfile")}</Link>
      </Button>
    </Panel>
  );
}

function ListingsBody({ author, add }: { author: ListingAuthor; add: boolean }) {
  const t = useTranslations("listings");
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ListingScope>("active");
  const [dialog, setDialog] = useState<ListingDialogTarget | null>(add ? { mode: "new" } : null);
  const listings = useOwnListings(author.kind === "VENUE_SEEKING" ? author.venueId : undefined, scope);

  const close = useMutation({
    mutationFn: async (listing: Listing) =>
      unwrap(await api.POST("/api/v1/listings/{id}/close", { params: { path: { id: listing.id } } })),
    onSuccess: () => {
      toast.success(t("closed"));
      return queryClient.invalidateQueries({ queryKey: LISTINGS });
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("filter")} className="flex">
          {(["active", "ended"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={scope === option}
              onClick={() => setScope(option)}
              className={
                "-mr-0.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (scope === option ? "border-primary bg-primary text-primary-foreground" : "bg-field hover:bg-muted")
              }
            >
              {t(`scopes.${option}`)}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setDialog({ mode: "new" })}>
          <Plus className="size-4" aria-hidden="true" />
          {author.kind === "ARTIST_AVAILABLE" ? t("addArtist") : t("addVenue")}
        </Button>
      </div>
      {listings.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : listings.isError ? (
        <ApiErrorState error={listings.error} onRetry={() => listings.refetch()} />
      ) : listings.data.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">{t(`empty.${scope}`)}</p>
        </Panel>
      ) : (
        <ul aria-label={t(`scopes.${scope}`)} className="grid gap-3 md:grid-cols-2">
          {listings.data.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onEdit={() => setDialog({ mode: "edit", listing })}
              onCopy={() => setDialog({ mode: "copy", listing })}
              onClose={() => close.mutate(listing)}
              closing={close.isPending}
            />
          ))}
        </ul>
      )}
      <ListingDialog target={dialog} author={author} onClose={() => setDialog(null)} />
    </>
  );
}
