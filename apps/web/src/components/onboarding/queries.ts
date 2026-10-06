"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ArtistProfile, Venue } from "./profile-requests";

export const ARTIST_PROFILE = ["artists", "me"] as const;
export const MY_VENUES = ["venues", "mine"] as const;

/** The signed-in artist's profile, or null before the first save. */
export function useArtistProfile(enabled = true) {
  return useQuery({
    queryKey: ARTIST_PROFILE,
    queryFn: async (): Promise<ArtistProfile | null> => {
      const result = await api.GET("/api/v1/artists/me");
      if (result.response.status === 404) return null;
      return unwrap(result);
    },
    enabled,
  });
}

/** The venues the signed-in account is in the team of, oldest first. */
export function useMyVenues(enabled = true) {
  return useQuery({
    queryKey: MY_VENUES,
    queryFn: async (): Promise<Venue[]> => unwrap(await api.GET("/api/v1/venues/mine")),
    enabled,
  });
}

/**
 * Where a profile stands for onboarding: missing (never saved), a draft with what is still missing, or published.
 * Roles without a profile (booker, admin) are "none"; "error" means it could not be read, so nobody gets blocked.
 */
export type ProfileProgress =
  | { status: "loading" }
  | { status: "error" }
  | { status: "none" }
  | { status: "missing" }
  | { status: "draft"; missing: number }
  | { status: "published" };

export function useProfileProgress(role: string): ProfileProgress {
  const artist = useArtistProfile(role === "ARTIST");
  const venues = useMyVenues(role === "VENUE");
  if (role === "ARTIST") {
    if (artist.isError) return { status: "error" };
    if (!artist.isSuccess) return { status: "loading" };
    return progress(artist.data);
  }
  if (role === "VENUE") {
    if (venues.isError) return { status: "error" };
    if (!venues.isSuccess) return { status: "loading" };
    return progress(venues.data[0] ?? null);
  }
  return { status: "none" };
}

function progress(profile: { published: boolean; missingForPublication: unknown[] } | null): ProfileProgress {
  if (!profile) return { status: "missing" };
  if (profile.published) return { status: "published" };
  return { status: "draft", missing: profile.missingForPublication.length };
}
