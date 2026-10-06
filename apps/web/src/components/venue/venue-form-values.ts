import { z } from "zod";
import { GENRES, MAX_GENRES, VENUE_TYPES } from "@/components/onboarding/options";
import type { Venue, VenueRequest } from "@/components/onboarding/profile-requests";
import type { Point } from "@/components/onboarding/venue-address-fields";
import { VENUE_LINKS } from "./venue-profile-view";

export const MAX_PHOTOS = 12;
export const MAX_TAGS = 10;
const MAX_CAPACITY = 100_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const text = (max: number) => z.string().trim().max(max, "validation.tooLong");
const link = z
  .string()
  .trim()
  .refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "validation.https");
const image = z.object({ id: z.string(), url: z.string() });

// Mirrors the backend rules (SaveVenueRequest); the server stays the authority.
export const venueSchema = z
  .object({
    name: z.string().trim().min(1, "validation.required").max(120, "validation.tooLong"),
    type: z.enum(VENUE_TYPES, "validation.required"),
    slug: z.string().trim().min(3, "validation.slug").max(40, "validation.slug").regex(SLUG, "validation.slug"),
    capacity: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "validation.number")
      .refine((value) => value === "" || (Number(value) >= 1 && Number(value) <= MAX_CAPACITY), "validation.capacity"),
    street: text(120),
    postalCode: text(12),
    city: text(120),
    genres: z.array(z.enum(GENRES)).max(MAX_GENRES),
    tags: z.array(z.string()).max(MAX_TAGS),
    description: text(2000),
    links: z.object(
      Object.fromEntries(VENUE_LINKS.map((key) => [key, link])) as Record<(typeof VENUE_LINKS)[number], typeof link>,
    ),
    avatar: image.nullable(),
    photos: z.array(image).max(MAX_PHOTOS),
  })
  // The address is optional, but a started one needs both the street and the city.
  .superRefine((v, ctx) => {
    if (v.street === "" && v.city === "" && v.postalCode === "") return;
    if (v.street === "") ctx.addIssue({ code: "custom", path: ["street"], message: "validation.required" });
    if (v.city === "") ctx.addIssue({ code: "custom", path: ["city"], message: "validation.required" });
  });

export type VenueValues = z.infer<typeof venueSchema>;

const orEmpty = (value: string | null | undefined) => value ?? "";

export function toValues(venue: Venue): VenueValues {
  return {
    name: venue.name,
    type: venue.type,
    slug: venue.slug,
    capacity: venue.capacity != null ? String(venue.capacity) : "",
    street: orEmpty(venue.address?.street),
    postalCode: orEmpty(venue.address?.postalCode),
    city: orEmpty(venue.address?.city),
    genres: venue.genres,
    tags: venue.tags,
    description: orEmpty(venue.description),
    links: Object.fromEntries(VENUE_LINKS.map((key) => [key, orEmpty(venue.links[key])])) as VenueValues["links"],
    avatar: venue.avatar ? { id: venue.avatar.id, url: venue.avatar.medium } : null,
    photos: venue.photos.map((photo) => ({ id: photo.id, url: photo.small })),
  };
}

const blankToUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

/**
 * The whole venue for `PUT /venues/{id}`. The slug goes only when it changed. The address carries the point of a
 * picked suggestion; without one the backend keeps the stored point for unchanged text, or geocodes new text.
 */
export function toRequest(values: VenueValues, current: Venue, point?: Point): VenueRequest {
  const slug = values.slug.trim();
  const street = values.street.trim();
  return {
    name: values.name.trim(),
    type: values.type,
    slug: slug === current.slug ? undefined : slug,
    description: blankToUndefined(values.description),
    capacity: values.capacity.trim() === "" ? undefined : Number(values.capacity),
    address: street
      ? { street, postalCode: blankToUndefined(values.postalCode), city: values.city.trim(), ...point }
      : undefined,
    genres: values.genres,
    tags: values.tags,
    links: Object.fromEntries(VENUE_LINKS.map((key) => [key, blankToUndefined(values.links[key])])),
    avatarMediaId: values.avatar?.id,
    photoMediaIds: values.photos.map((photo) => photo.id),
  };
}
