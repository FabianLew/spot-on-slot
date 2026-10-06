import type { ApiSchemas, paths } from "@spot-on-slot/api-client";
import { addDays, instantAt } from "@/components/calendar/warsaw-time";
import { GENRES, VENUE_TYPES } from "@/components/onboarding/options";
import type { Genre, VenueType } from "@/components/onboarding/profile-requests";

/**
 * The search screen's state as it lives in the address (`/search?tab=...`), and the API queries made from it.
 * Times are Warsaw wall-clock times; the budget is typed in zł and sent in grosze.
 */

export type SearchTab = "artists" | "venues" | "listings";
export type ListingKind = ApiSchemas["SearchListing"]["kind"];

export const TABS: readonly SearchTab[] = ["artists", "venues", "listings"];
export const KINDS: readonly ListingKind[] = ["ARTIST_AVAILABLE", "VENUE_SEEKING"];
export const RADII = [5, 10, 25, 50, 100, 200] as const;
export const DEFAULT_RADIUS_KM = 50;
export const MAX_RADIUS_KM = 200;

export type Center = { lat: number; lng: number };

export type SearchState = {
  tab: SearchTab;
  /** A picked place (with its name) or a map area; without it the account's own place is used. */
  center?: Center & { label?: string; area: boolean };
  radiusKm: number;
  genres: Genre[];
  /** `YYYY-MM-DD` with optional `HH:mm` hours; an end at or before the start is on the next day. */
  date?: string;
  from?: string;
  to?: string;
  /** Whole złote. */
  budget?: number;
  willTravel: boolean;
  types: VenueType[];
  kind?: ListingKind;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A venue account looks for artists, an artist for venues' "Szukam artysty" listings. */
export const defaultTab = (role: string): SearchTab => (role === "ARTIST" ? "listings" : "artists");

function number(value: string | null, min: number, max: number) {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

const oneOf = <T extends string>(values: readonly T[], value: string | null) =>
  values.find((candidate) => candidate === value);

const allOf = <T extends string>(values: readonly T[], picked: string[]) =>
  values.filter((value) => picked.includes(value));

const matching = (pattern: RegExp, value: string | null) => (value != null && pattern.test(value) ? value : undefined);

export function parseSearch(params: URLSearchParams, fallbackTab: SearchTab): SearchState {
  const lat = number(params.get("lat"), -90, 90);
  const lng = number(params.get("lng"), -180, 180);
  const radius = number(params.get("radius"), 1, MAX_RADIUS_KM);
  const budget = number(params.get("budget"), 0, 10_000_000);
  const label = params.get("place")?.trim();
  const state: SearchState = {
    tab: oneOf(TABS, params.get("tab")) ?? fallbackTab,
    radiusKm: radius != null ? Math.round(radius) : DEFAULT_RADIUS_KM,
    genres: allOf(GENRES, params.getAll("genre")),
    willTravel: params.get("travel") === "1",
    types: allOf(VENUE_TYPES, params.getAll("type")),
  };
  if (lat != null && lng != null) {
    state.center = { lat, lng, ...(label ? { label } : {}), area: params.get("area") === "1" };
  }
  const date = matching(DAY, params.get("date"));
  if (date) state.date = date;
  const from = matching(TIME, params.get("from"));
  const to = matching(TIME, params.get("to"));
  if (from) state.from = from;
  if (to) state.to = to;
  if (budget != null) state.budget = Math.round(budget);
  const kind = oneOf(KINDS, params.get("kind"));
  if (kind) state.kind = kind;
  return state;
}

/** The address of `state`; only what differs from the defaults is written. */
export function searchHref(state: SearchState): string {
  const params = new URLSearchParams();
  params.set("tab", state.tab);
  if (state.center) {
    params.set("lat", String(state.center.lat));
    params.set("lng", String(state.center.lng));
    if (state.center.label) params.set("place", state.center.label);
    if (state.center.area) params.set("area", "1");
  }
  if (state.radiusKm !== DEFAULT_RADIUS_KM) params.set("radius", String(state.radiusKm));
  state.genres.forEach((genre) => params.append("genre", genre));
  if (state.date) params.set("date", state.date);
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.budget != null) params.set("budget", String(state.budget));
  if (state.willTravel) params.set("travel", "1");
  state.types.forEach((type) => params.append("type", type));
  if (state.kind) params.set("kind", state.kind);
  return `/search?${params.toString()}`;
}

/** `[from, to)` as instants: the given hours (end at or before start = next day) or, if `wholeDay`, the date. */
function range(state: SearchState, wholeDay: boolean): { from: string; to: string } | undefined {
  if (!state.date) return undefined;
  if (state.from && state.to) {
    const endDay = state.to <= state.from ? addDays(state.date, 1) : state.date;
    return {
      from: instantAt(state.date, state.from).toISOString(),
      to: instantAt(endDay, state.to).toISOString(),
    };
  }
  if (!wholeDay) return undefined;
  return {
    from: instantAt(state.date, "00:00").toISOString(),
    to: instantAt(addDays(state.date, 1), "00:00").toISOString(),
  };
}

const area = (state: SearchState, center: Center) => ({
  lat: center.lat,
  lng: center.lng,
  radiusKm: state.radiusKm,
  ...(state.genres.length > 0 ? { genres: state.genres } : {}),
});

const grosze = (state: SearchState) => (state.budget != null ? { budget: state.budget * 100 } : {});

type Query<P extends keyof paths> = NonNullable<NonNullable<paths[P]["get"]>["parameters"]["query"]>;

export type ArtistQuery = Query<"/api/v1/search/artists">;
export type VenueQuery = Query<"/api/v1/search/venues">;
export type ListingQuery = Query<"/api/v1/search/listings">;

/** Artists free for the whole given time (a date without hours does not filter them). */
export function artistQuery(state: SearchState, center: Center): ArtistQuery {
  return {
    ...area(state, center),
    ...range(state, false),
    ...grosze(state),
    ...(state.willTravel ? { willTravel: true } : {}),
  };
}

export function venueQuery(state: SearchState, center: Center): VenueQuery {
  return { ...area(state, center), ...(state.types.length > 0 ? { types: state.types } : {}) };
}

/** Listings overlapping the given hours or, with a date alone, that whole day. */
export function listingQuery(state: SearchState, center: Center): ListingQuery {
  return {
    ...area(state, center),
    ...(state.kind ? { kind: state.kind } : {}),
    ...range(state, true),
    ...grosze(state),
  };
}
