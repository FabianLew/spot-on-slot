"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMyVenues } from "@/components/onboarding/queries";
import { api } from "@/lib/api";
import { artistQuery, listingQuery, venueQuery, type Center, type SearchState, type SearchTab } from "./search-params";

export type ArtistHit = ApiSchemas["SearchArtist"];
export type VenueHit = ApiSchemas["SearchVenue"];
export type ListingHit = ApiSchemas["SearchListing"];
export type Hit =
  | { tab: "artists"; hit: ArtistHit }
  | { tab: "venues"; hit: VenueHit }
  | { tab: "listings"; hit: ListingHit };

export const SEARCH = ["search"] as const;
/** Results per "Pokaż więcej". */
export const PAGE_SIZE = 20;
/** Pins on the map: the nearest this many. */
export const MAP_SIZE = 100;

type Page = { hits: Hit[]; totalElements: number };

async function fetchPage(
  tab: SearchTab,
  state: SearchState,
  center: Center,
  page: number,
  size: number,
  signal: AbortSignal,
): Promise<Page> {
  const paging = { page, size };
  // Each tab has its own response type; the hits are tagged with their tab.
  if (tab === "artists") {
    const result = unwrap(
      await api.GET("/api/v1/search/artists", {
        params: { query: { ...artistQuery(state, center), ...paging } },
        signal,
      }),
    );
    return { hits: (result.content ?? []).map((hit) => ({ tab, hit })), totalElements: result.totalElements ?? 0 };
  }
  if (tab === "venues") {
    const result = unwrap(
      await api.GET("/api/v1/search/venues", {
        params: { query: { ...venueQuery(state, center), ...paging } },
        signal,
      }),
    );
    return { hits: (result.content ?? []).map((hit) => ({ tab, hit })), totalElements: result.totalElements ?? 0 };
  }
  const result = unwrap(
    await api.GET("/api/v1/search/listings", {
      params: { query: { ...listingQuery(state, center), ...paging } },
      signal,
    }),
  );
  return { hits: (result.content ?? []).map((hit) => ({ tab, hit })), totalElements: result.totalElements ?? 0 };
}

/** What a result list depends on: the tab, the centre and the filters (not the page). */
const key = (state: SearchState, center: Center | undefined) => {
  const filters = { ...state, center: undefined };
  return [...SEARCH, state.tab, center?.lat, center?.lng, filters];
};

/** The list: pages of 20, nearest first. Earlier results stay visible while new ones load. */
export function useSearchList(state: SearchState, center: Center | undefined) {
  return useInfiniteQuery({
    enabled: center != null,
    queryKey: [...key(state, center), "list"],
    queryFn: ({ pageParam, signal }) => fetchPage(state.tab, state, center!, pageParam, PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.totalElements ? pages.length : undefined),
    placeholderData: keepPreviousData,
  });
}

/** The map's pins: the 100 nearest at once. */
export function useSearchPins(state: SearchState, center: Center | undefined) {
  return useQuery({
    enabled: center != null,
    queryKey: [...key(state, center), "map"],
    queryFn: ({ signal }) => fetchPage(state.tab, state, center!, 0, MAP_SIZE, signal),
    placeholderData: keepPreviousData,
  });
}

export type OwnPlace = Center & { label: string };

/**
 * Where the account is, as the default centre: an artist's own location; a venue account's first venue with a
 * point (they rarely set a personal location), else its own location. `null` when there is none.
 */
export function useOwnPlace(role: string) {
  const venues = useMyVenues(role === "VENUE");
  const venuePlace = venues.data
    ?.map((venue) => venue.address)
    .find((address) => address?.latitude != null && address.longitude != null);
  const needOwn = role !== "VENUE" || (venues.isSuccess && venuePlace == null) || venues.isError;
  const own = useQuery({
    enabled: needOwn,
    queryKey: ["location", "me"],
    queryFn: async (): Promise<OwnPlace | null> => {
      const result = await api.GET("/api/v1/locations/me");
      if (result.response.status === 404) return null;
      const location = unwrap(result);
      return { lat: location.latitude, lng: location.longitude, label: location.label };
    },
  });

  if (role === "VENUE" && venuePlace) {
    const name = venues.data?.find((venue) => venue.address === venuePlace)?.name ?? venuePlace.city;
    return { place: { lat: venuePlace.latitude!, lng: venuePlace.longitude!, label: name }, pending: false };
  }
  if (role === "VENUE" && venues.isPending) return { place: undefined, pending: true };
  if (own.isPending) return { place: undefined, pending: true };
  return { place: own.data ?? null, pending: false };
}
