"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useQuery } from "@tanstack/react-query";
import { BOOKINGS, COUNT_INTERVAL, scopeQuery, type Booking } from "@/components/bookings/queries";
import { local, today } from "@/components/calendar/warsaw-time";
import type { Venue } from "@/components/onboarding/profile-requests";
import { DEFAULT_RADIUS_KM } from "@/components/search/search-params";
import { api } from "@/lib/api";

/** Every dashboard section shows at most this many items. */
export const SECTION_SIZE = 3;

export type DashboardScope = "awaiting" | "upcoming";

/** The first bookings of a scope (soonest first) and how many there are, of one venue when `venueId` is set. */
export function useDashboardBookings(scope: DashboardScope, venueId?: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...BOOKINGS, "dashboard", scope, venueId ?? "all"],
    queryFn: async (): Promise<{ bookings: Booking[]; total: number }> => {
      const query = { ...scopeQuery(scope), venueId, size: SECTION_SIZE };
      const page = unwrap(await api.GET("/api/v1/bookings", { params: { query } }));
      return { bookings: page.content ?? [], total: page.totalElements ?? 0 };
    },
    refetchInterval: COUNT_INTERVAL,
  });
}

/** Accepted bookings playing today (in Warsaw) or already playing: "Dziś wieczorem". */
export function tonight(upcoming: Booking[], now: Date = new Date()): Booking[] {
  const day = today(now);
  return upcoming.filter((booking) => local(booking.startsAt).day === day || new Date(booking.startsAt) <= now);
}

/** How many published artists are within the default search radius of the venue; undefined without a point. */
export function useArtistsNearby(venue: Venue | undefined) {
  const lat = venue?.address?.latitude;
  const lng = venue?.address?.longitude;
  return useQuery({
    enabled: lat != null && lng != null,
    queryKey: ["search", "dashboard-nearby", lat, lng],
    queryFn: async (): Promise<number> => {
      const page = unwrap(
        await api.GET("/api/v1/search/artists", {
          params: { query: { lat: lat!, lng: lng!, radiusKm: DEFAULT_RADIUS_KM, size: 1 } },
        }),
      );
      return page.totalElements ?? 0;
    },
  });
}
