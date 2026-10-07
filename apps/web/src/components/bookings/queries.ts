"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BookingScope } from "./scopes";

export type Booking = ApiSchemas["BookingResponse"];
export type BookingStatus = Booking["status"];
export type BookingStep = Booking["steps"][number];


export const BOOKINGS = ["bookings"] as const;
export const PAGE_SIZE = 20;
/** How often the menu counter looks for new requests. */
export const COUNT_INTERVAL = 60_000;

const HISTORY: BookingStatus[] = ["COMPLETED", "CANCELLED", "DECLINED", "WITHDRAWN", "EXPIRED"];

/** The list query of a scope: open bookings soonest first, the history newest first. */
export function scopeQuery(scope: BookingScope) {
  switch (scope) {
    case "awaiting":
      return { awaitingMe: true, sort: "startsAt,asc" };
    case "pending":
      return { status: ["PENDING"] as BookingStatus[], sort: "startsAt,asc" };
    case "upcoming":
      return { status: ["ACCEPTED"] as BookingStatus[], sort: "startsAt,asc" };
    case "history":
      return { status: HISTORY, sort: "startsAt,desc" };
  }
}

type Page = { bookings: Booking[]; totalElements: number };

/** The caller's bookings in `scope`, of one venue when `venueId` is set, 20 per page. */
export function useBookings(scope: BookingScope, venueId?: string) {
  return useInfiniteQuery({
    queryKey: [...BOOKINGS, "list", scope, venueId ?? "all"],
    queryFn: async ({ pageParam }): Promise<Page> => {
      const query = { ...scopeQuery(scope), venueId, page: pageParam, size: PAGE_SIZE };
      const page = unwrap(await api.GET("/api/v1/bookings", { params: { query } }));
      return { bookings: page.content ?? [], totalElements: page.totalElements ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.totalElements ? pages.length : undefined),
  });
}

/** One booking, or null when the caller is not one of its sides (404). */
export function useBooking(id: string) {
  return useQuery({
    queryKey: [...BOOKINGS, "one", id],
    queryFn: async (): Promise<Booking | null> => {
      const result = await api.GET("/api/v1/bookings/{id}", { params: { path: { id } } });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });
}

/** How many bookings wait for the caller's answer (the menu counter). */
export function useAwaitingCount(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...BOOKINGS, "awaiting-count"],
    queryFn: async (): Promise<number> => {
      const page = unwrap(await api.GET("/api/v1/bookings", { params: { query: { awaitingMe: true, size: 1 } } }));
      return page.totalElements ?? 0;
    },
    refetchInterval: COUNT_INTERVAL,
  });
}
