import { z } from "zod";
import { GENRES, MAX_GENRES } from "@/components/onboarding/options";
import type { ArtistProfile, ArtistRequest } from "@/components/onboarding/profile-requests";
import { LINKS, SKILLS } from "./artist-profile-view";

export const MAX_PHOTOS = 12;
export const MAX_TAGS = 10;
const MAX_RATE_ZL = 100_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number) => z.string().trim().max(max, "validation.tooLong");
const link = z
  .string()
  .trim()
  .refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "validation.https");
const zl = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), "validation.number")
  .refine((value) => value === "" || Number(value) <= MAX_RATE_ZL, "validation.rateMax");
const image = z.object({ id: z.string(), url: z.string() });

// Mirrors the backend rules (artist SaveProfileRequest); the server stays the authority.
export const profileSchema = z
  .object({
    stageName: z.string().trim().min(1, "validation.required").max(60, "validation.tooLong"),
    slug: z.string().trim().min(3, "validation.slug").max(40, "validation.slug").regex(SLUG, "validation.slug"),
    firstName: optionalText(60),
    lastName: optionalText(80),
    genres: z.array(z.enum(GENRES)).max(MAX_GENRES),
    tags: z.array(z.string()).max(MAX_TAGS),
    bio: optionalText(2000),
    links: z.object(Object.fromEntries(LINKS.map((key) => [key, link])) as Record<(typeof LINKS)[number], typeof link>),
    rateFrom: zl,
    rateTo: zl,
    travelRadiusKm: z
      .string()
      .trim()
      .regex(/^\d+$/, "validation.number")
      .refine((value) => Number(value) <= 500, "validation.travelRange"),
    skills: z.object(
      Object.fromEntries(SKILLS.map((key) => [key, z.number().int().min(0).max(10)])) as Record<
        (typeof SKILLS)[number],
        z.ZodNumber
      >,
    ),
    avatar: image.nullable(),
    photos: z.array(image).max(MAX_PHOTOS),
  })
  .refine((v) => v.rateFrom === "" || v.rateTo === "" || Number(v.rateFrom) <= Number(v.rateTo), {
    path: ["rateTo"],
    message: "validation.rateOrder",
  });

export type ProfileValues = z.infer<typeof profileSchema>;

const text = (value: string | null | undefined) => value ?? "";
const zlText = (grosze: number | null | undefined) => (grosze != null ? String(Math.round(grosze / 100)) : "");

export function toValues(profile: ArtistProfile): ProfileValues {
  return {
    stageName: profile.stageName,
    slug: profile.slug,
    firstName: text(profile.firstName),
    lastName: text(profile.lastName),
    genres: profile.genres,
    tags: profile.tags,
    bio: text(profile.bio),
    links: Object.fromEntries(LINKS.map((key) => [key, text(profile.links[key])])) as ProfileValues["links"],
    rateFrom: zlText(profile.rate?.from),
    rateTo: zlText(profile.rate?.to),
    travelRadiusKm: String(profile.travelRadiusKm),
    skills: Object.fromEntries(SKILLS.map((key) => [key, profile.skills[key] ?? 0])) as ProfileValues["skills"],
    avatar: profile.avatar ? { id: profile.avatar.id, url: profile.avatar.medium } : null,
    photos: profile.photos.map((photo) => ({ id: photo.id, url: photo.small })),
  };
}

const blankToUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());
const grosze = (value: string) => (value.trim() === "" ? undefined : Number(value) * 100);

/** The whole profile for `PUT /artists/me`; the slug is sent only when it changed, so the address stays put. */
export function toRequest(values: ProfileValues, current: ArtistProfile): ArtistRequest {
  const slug = values.slug.trim();
  return {
    stageName: values.stageName.trim(),
    slug: slug === current.slug ? undefined : slug,
    firstName: blankToUndefined(values.firstName),
    lastName: blankToUndefined(values.lastName),
    bio: blankToUndefined(values.bio),
    genres: values.genres,
    tags: values.tags,
    links: Object.fromEntries(LINKS.map((key) => [key, blankToUndefined(values.links[key])])),
    rateFrom: grosze(values.rateFrom),
    rateTo: grosze(values.rateTo),
    travelRadiusKm: Number(values.travelRadiusKm),
    skills: Object.fromEntries(SKILLS.map((key) => [key, values.skills[key] || undefined])),
    avatarMediaId: values.avatar?.id,
    photoMediaIds: values.photos.map((photo) => photo.id),
  };
}
