/**
 * Sample data for the design preview (/design), taken from the first mockups.
 * Replaced by API data once the artist, venue, availability and booking modules exist.
 */
export const sampleDj = {
  name: "Weronika",
  city: "Warszawa, PL",
  radiusKm: 50,
  genres: ["Techno", "House", "Trance"],
  skills: [
    { key: "tempo", value: 8 },
    { key: "experience", value: 5 },
    { key: "energy", value: 8 },
    { key: "vinyl", value: 6 },
    { key: "cdj", value: 9 },
    { key: "production", value: 7 },
  ],
  // Calendar days (no time of day), as the availability module will return them.
  openDates: ["2026-10-12", "2026-10-18", "2026-10-25", "2026-10-26", "2026-11-02"],
} as const;

export const sampleVenue = {
  name: "Schron",
  city: "Poznań / PL",
  capacity: 350,
  floors: 2,
  genres: ["Techno", "House", "Electro"],
  djsNearby: 24,
  openRequests: 7,
  openSlots: [
    { startsAt: "2026-10-03T23:00:00+02:00", room: "main" },
    { startsAt: "2026-10-10T22:00:00+02:00", room: "b" },
    { startsAt: "2026-10-17T00:00:00+02:00", room: "main" },
  ],
  live: { rooms: 2, djs: 3 },
} as const;

export type SkillKey = (typeof sampleDj.skills)[number]["key"];

/** "2026-10-12" as a local Date at midnight (for the calendar grid). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** "2026-10-12" as an instant at noon UTC, which is the same calendar day in Europe/Warsaw (for formatting). */
export function dayInstant(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}
