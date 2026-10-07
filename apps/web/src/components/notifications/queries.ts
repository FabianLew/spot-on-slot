"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

export type AppNotification = ApiSchemas["NotificationResponse"];
export type NearbyListing = ApiSchemas["NearbyListingResponse"];
export type NotificationPreferences = ApiSchemas["PreferencesResponse"];
export type NearbyListingsRequest = ApiSchemas["NearbyListingsRequest"];

export const NOTIFICATIONS = ["notifications"] as const;

const PAGE_SIZE = 20;
/** The bell asks this often (and when the tab comes back into focus) until WebSocket pushes arrive with B11. */
export const UNREAD_POLL_MS = 60_000;

export function useUnreadCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS, "unread"],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/notifications/unread-count")).count,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Newest first, a page at a time. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS, "list"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/notifications", {
          params: { query: { page: pageParam, size: PAGE_SIZE } },
        }),
      ),
    getNextPageParam: (last) =>
      last.page != null &&
      last.totalPages != null &&
      last.page + 1 < last.totalPages
        ? last.page + 1
        : undefined,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/api/v1/notifications/{id}/read", {
          params: { path: { id } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/api/v1/notifications/read-all")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS }),
  });
}

const PREFERENCES = [...NOTIFICATIONS, "preferences"] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: PREFERENCES,
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/notifications/preferences")),
  });
}

export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nearbyListings: NearbyListingsRequest) =>
      unwrap(
        await api.PUT("/api/v1/notifications/preferences", {
          body: { nearbyListings },
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(PREFERENCES, saved),
  });
}
