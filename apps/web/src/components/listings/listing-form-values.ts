import { z } from "zod";
import { GENRES, MAX_GENRES } from "@/components/onboarding/options";
import type { Genre } from "@/components/onboarding/profile-requests";
import { addDays, instantAt, local } from "@/components/calendar/warsaw-time";
import { zl } from "./listing-time";
import type { Listing, ListingRequest } from "./queries";

export const MAX_ARTIST_DESCRIPTION = 500;
export const MAX_VENUE_DESCRIPTION = 1000;
const MAX_PRICE_ZL = 100_000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const amount = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), "validation.number")
  .refine((value) => value === "" || Number(value) <= MAX_PRICE_ZL, "validation.rateMax");

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Mirrors the backend rules (listing ListingRequest); the server stays the authority.
export const listingSchema = z
  .object({
    /** Artists: the chosen free time; venues: built from date and hours. */
    startsAt: z.string(),
    endsAt: z.string(),
    date: z.string(),
    from: z.string(),
    to: z.string(),
    genres: z.array(z.enum(GENRES)).min(1, "validation.genresRequired").max(MAX_GENRES),
    description: z.string().trim().max(MAX_VENUE_DESCRIPTION, "validation.tooLong"),
    priceFrom: amount,
    priceTo: amount,
    travelRadiusKm: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "validation.number")
      .refine((value) => value === "" || Number(value) <= 500, "validation.travelRange"),
  })
  .refine((v) => v.priceFrom === "" || v.priceTo === "" || Number(v.priceFrom) <= Number(v.priceTo), {
    path: ["priceTo"],
    message: "validation.rateOrder",
  });

export type ListingValues = z.infer<typeof listingSchema>;

/** Venues type hours, so these must be valid; artists take times from the calendar. */
export const venueSchema = listingSchema.superRefine((v, ctx) => {
  if (!v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "validation.required" });
  if (!TIME.test(v.from)) ctx.addIssue({ code: "custom", path: ["from"], message: "validation.time" });
  if (!TIME.test(v.to)) ctx.addIssue({ code: "custom", path: ["to"], message: "validation.time" });
});

export const artistSchema = listingSchema.refine((v) => v.description.length <= MAX_ARTIST_DESCRIPTION, {
  path: ["description"],
  message: "validation.tooLong",
});

const zlText = (grosze: number | null | undefined) => (grosze != null ? String(zl(grosze)) : "");

/** Defaults: genres and money from the profile, time from the chosen free slot (artists) or tonight (venues). */
export function blankValues(defaults: {
  genres: Genre[];
  priceFrom?: number | null;
  priceTo?: number | null;
  travelRadiusKm?: number | null;
  day: string;
}): ListingValues {
  return {
    startsAt: "",
    endsAt: "",
    date: defaults.day,
    from: "21:00",
    to: "03:00",
    genres: defaults.genres.slice(0, MAX_GENRES),
    description: "",
    priceFrom: zlText(defaults.priceFrom),
    priceTo: zlText(defaults.priceTo),
    travelRadiusKm: defaults.travelRadiusKm != null ? String(defaults.travelRadiusKm) : "",
  };
}

/** A stored listing as form values; `copy` keeps everything but the time ("Dodaj podobne"). */
export function toValues(listing: Listing, copy = false): ListingValues {
  const start = local(listing.startsAt);
  const end = local(listing.endsAt);
  return {
    startsAt: copy ? "" : listing.startsAt,
    endsAt: copy ? "" : listing.endsAt,
    date: start.day,
    from: start.time,
    to: end.time,
    genres: listing.genres,
    description: listing.description ?? "",
    priceFrom: zlText(listing.priceFrom),
    priceTo: zlText(listing.priceTo),
    travelRadiusKm: listing.travelRadiusKm != null ? String(listing.travelRadiusKm) : "",
  };
}

/** Whether `to` is on the next day (an end at or before the start). */
export const endsNextDay = (from: string, to: string) =>
  TIME.test(from) && TIME.test(to) && minutes(to) <= minutes(from);

const grosze = (value: string) => (value.trim() === "" ? undefined : Number(value) * 100);

export function toRequest(values: ListingValues, kind: Listing["kind"]): ListingRequest {
  const times =
    kind === "ARTIST_AVAILABLE"
      ? { startsAt: values.startsAt, endsAt: values.endsAt }
      : {
          startsAt: instantAt(values.date, values.from).toISOString(),
          endsAt: instantAt(
            endsNextDay(values.from, values.to) ? addDays(values.date, 1) : values.date,
            values.to,
          ).toISOString(),
        };
  return {
    ...times,
    genres: [...values.genres].sort((a, b) => GENRES.indexOf(a) - GENRES.indexOf(b)),
    description: values.description.trim() || undefined,
    priceFrom: grosze(values.priceFrom),
    priceTo: grosze(values.priceTo),
    travelRadiusKm:
      kind === "ARTIST_AVAILABLE" && values.travelRadiusKm.trim() !== "" ? Number(values.travelRadiusKm) : undefined,
  };
}
