"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Occurrence } from "@/components/calendar/queries";

export type Listing = ApiSchemas["ListingResponse"];
export type ListingRequest = ApiSchemas["ListingRequest"];
export type ListingStatus = Listing["status"];

/** "Aktywne" or "Zakończone" (closed, expired and filled). */
export type ListingScope = "active" | "ended";

export const LISTINGS = ["listings"] as const;

/** Enough for every active listing (limits: 20 per artist, 30 per venue) and the recent ended ones. */
const PAGE_SIZE = 100;

const inScope = (scope: ListingScope) => (listing: Listing) =>
  scope === "active" ? listing.status === "ACTIVE" : listing.status !== "ACTIVE";

/** The signed-in artist's listings in `scope`, newest first. */
export function useArtistListings(scope: ListingScope, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...LISTINGS, "mine", scope],
    queryFn: async (): Promise<Listing[]> => {
      const page = unwrap(
        await api.GET("/api/v1/listings/mine", {
          params: { query: { size: PAGE_SIZE, ...(scope === "active" ? { status: "ACTIVE" } : {}) } },
        }),
      );
      return (page.content ?? []).filter(inScope(scope));
    },
  });
}

/** Listings of a venue the account is in the team of, in `scope`, newest first. */
export function useVenueListings(venueId: string | undefined, scope: ListingScope) {
  return useQuery({
    enabled: venueId != null,
    queryKey: [...LISTINGS, "venue", venueId, scope],
    queryFn: async (): Promise<Listing[]> => {
      const page = unwrap(
        await api.GET("/api/v1/venues/{venueId}/listings", {
          params: {
            path: { venueId: venueId! },
            query: { size: PAGE_SIZE, ...(scope === "active" ? { status: "ACTIVE" } : {}) },
          },
        }),
      );
      return (page.content ?? []).filter(inScope(scope));
    },
  });
}

/** The listings of a venue (by id) or, without one, of the signed-in artist. */
export function useOwnListings(venueId: string | undefined, scope: ListingScope) {
  const artist = useArtistListings(scope, venueId == null);
  const venue = useVenueListings(venueId, scope);
  return venueId == null ? artist : venue;
}

/** The active listing announcing (part of) `entry`, if any. */
export function announcing(listings: Listing[] | undefined, entry: Pick<Occurrence, "startsAt" | "endsAt">) {
  const from = new Date(entry.startsAt).getTime();
  const to = new Date(entry.endsAt).getTime();
  return listings?.find(
    (listing) =>
      listing.status === "ACTIVE" &&
      new Date(listing.startsAt).getTime() < to &&
      new Date(listing.endsAt).getTime() > from,
  );
}
