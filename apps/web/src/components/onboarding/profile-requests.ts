import type { ApiSchemas } from "@spot-on-slot/api-client";

export type ArtistProfile = ApiSchemas["ProfileResponse"];
export type ArtistRequest = ApiSchemas["SaveProfileRequest"];
export type Venue = ApiSchemas["VenueResponse"];
export type VenueRequest = ApiSchemas["SaveVenueRequest"];
export type Genre = ArtistProfile["genres"][number];
export type VenueType = Venue["type"];

/**
 * The whole artist profile for `PUT /artists/me` (it replaces everything), so a wizard step that edits a few fields
 * keeps the rest. The slug is left out, which keeps the current address.
 */
export function artistRequest(current: ArtistProfile | null, patch: Partial<ArtistRequest>): ArtistRequest {
  const base: ArtistRequest = current
    ? {
        stageName: current.stageName,
        firstName: current.firstName,
        lastName: current.lastName,
        bio: current.bio,
        genres: current.genres,
        tags: current.tags,
        links: current.links,
        rateFrom: current.rate?.from,
        rateTo: current.rate?.to,
        travelRadiusKm: current.travelRadiusKm,
        skills: current.skills,
        avatarMediaId: current.avatar?.id,
        photoMediaIds: current.photos.map((photo) => photo.id),
      }
    : { stageName: "" };
  return { ...base, ...patch };
}

/** The whole venue for `POST /venues` or `PUT /venues/{id}`, the same way. */
export function venueRequest(current: Venue | null, patch: Partial<VenueRequest>): VenueRequest {
  const base: VenueRequest = current
    ? {
        name: current.name,
        type: current.type,
        description: current.description,
        capacity: current.capacity,
        address: current.address,
        genres: current.genres,
        tags: current.tags,
        links: current.links,
        avatarMediaId: current.avatar?.id,
        photoMediaIds: current.photos.map((photo) => photo.id),
      }
    : { name: "", type: "CLUB" };
  return { ...base, ...patch };
}
