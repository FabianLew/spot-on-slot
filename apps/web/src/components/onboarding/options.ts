import type { Genre, VenueType } from "./profile-requests";

/** The backend's genre catalogue (`artist.Genre`) in display order; names come from `genres.*`. */
export const GENRES = [
  "TECHNO",
  "MELODIC_TECHNO",
  "HOUSE",
  "TECH_HOUSE",
  "DEEP_HOUSE",
  "AFRO_HOUSE",
  "MINIMAL",
  "TRANCE",
  "PSYTRANCE",
  "DRUM_AND_BASS",
  "DUBSTEP",
  "BREAKBEAT",
  "ELECTRO",
  "DISCO",
  "FUNK",
  "HIP_HOP",
  "RNB",
  "POP",
  "LATIN",
  "ROCK",
  "JAZZ",
  "AMBIENT",
  "OPEN_FORMAT",
] as const satisfies readonly Genre[];

export const VENUE_TYPES = [
  "CLUB",
  "BAR",
  "PUB",
  "CONCERT_HALL",
  "EVENT_HALL",
  "RESTAURANT",
  "OTHER",
] as const satisfies readonly VenueType[];

export const MAX_GENRES = 5;
