"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { api } from "@/lib/api";
import type { ReportKind } from "./queries";

const body = (reason: string) => ({ reason });

/** Admin actions; each needs a reason. Callers refresh the panel's queries afterwards. */
export const adminActions = {
  hideArtist: async (profileId: string, reason: string) =>
    unwrap(await api.POST("/api/v1/admin/artists/{profileId}/hide", { params: { path: { profileId } }, body: body(reason) })),
  restoreArtist: async (profileId: string, reason: string) =>
    unwrap(
      await api.POST("/api/v1/admin/artists/{profileId}/restore", { params: { path: { profileId } }, body: body(reason) }),
    ),
  hideVenue: async (venueId: string, reason: string) =>
    unwrap(await api.POST("/api/v1/admin/venues/{venueId}/hide", { params: { path: { venueId } }, body: body(reason) })),
  restoreVenue: async (venueId: string, reason: string) =>
    unwrap(await api.POST("/api/v1/admin/venues/{venueId}/restore", { params: { path: { venueId } }, body: body(reason) })),
  closeListing: async (listingId: string, reason: string) =>
    unwrap(
      await api.POST("/api/v1/admin/listings/{listingId}/close", { params: { path: { listingId } }, body: body(reason) }),
    ),
  block: async (userId: string, reason: string) =>
    unwrap(await api.POST("/api/v1/admin/users/{userId}/block", { params: { path: { userId } }, body: body(reason) })),
  unblock: async (userId: string, reason: string) =>
    unwrap(await api.POST("/api/v1/admin/users/{userId}/unblock", { params: { path: { userId } }, body: body(reason) })),
  dismiss: async (kind: ReportKind, targetId: string, reason: string) =>
    unwrap(
      await api.POST("/api/v1/admin/reports/{kind}/{targetId}/dismiss", {
        params: { path: { kind, targetId } },
        body: body(reason),
      }),
    ),
};
