import { createApiClient, unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { cache } from "react";

export type PublicArtist = ApiSchemas["PublicProfileResponse"];

// Server-side reads of public data: no token, and the backend may sit on an internal address (API_URL).
const publicApi = createApiClient({
  baseUrl: process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
});

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A published artist by slug, or null when there is none (drafts do not exist for the public). Cached per
 * request, so the page and its metadata share one call.
 */
export const findPublicArtist = cache(async (slug: string): Promise<PublicArtist | null> => {
  if (slug.length < 3 || slug.length > 40 || !SLUG.test(slug)) return null;
  const result = await publicApi.GET("/api/v1/public/artists/{slug}", {
    params: { path: { slug } },
    cache: "no-store",
  });
  if (result.response.status === 404) return null;
  return unwrap(result);
});

export type PublicVenue = ApiSchemas["PublicVenueResponse"];

/** A published venue by slug, or null when there is none; cached per request like `findPublicArtist`. */
export const findPublicVenue = cache(async (slug: string): Promise<PublicVenue | null> => {
  if (slug.length < 3 || slug.length > 40 || !SLUG.test(slug)) return null;
  const result = await publicApi.GET("/api/v1/public/venues/{slug}", {
    params: { path: { slug } },
    cache: "no-store",
  });
  if (result.response.status === 404) return null;
  return unwrap(result);
});

export type PublicFreeTime = ApiSchemas["PublicOccurrenceResponse"];

/** A published artist's free and booked time for the next `days` days; empty when it cannot be read. */
export async function findPublicAvailability(slug: string, days: number, now = new Date()): Promise<PublicFreeTime[]> {
  const result = await publicApi.GET("/api/v1/public/artists/{slug}/availability", {
    params: {
      path: { slug },
      query: { from: now.toISOString(), to: new Date(now.getTime() + days * 86_400_000).toISOString() },
    },
    cache: "no-store",
  });
  return result.response.ok && result.data ? result.data : [];
}

export type PublicListing = ApiSchemas["ListingResponse"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An active listing by id, or null when there is none (closed, expired, unpublished author); cached per request. */
export const findPublicListing = cache(async (id: string): Promise<PublicListing | null> => {
  if (!UUID.test(id)) return null;
  const result = await publicApi.GET("/api/v1/public/listings/{id}", {
    params: { path: { id } },
    cache: "no-store",
  });
  if (result.response.status === 404) return null;
  return unwrap(result);
});
