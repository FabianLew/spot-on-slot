/**
 * Calendar arithmetic in the artists' time zone, independent of the browser's own zone.
 * Days are ISO strings ("2026-10-12"), times "HH:mm".
 */
export const ZONE = "Europe/Warsaw";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The zone's wall clock at `instant`: day and time. */
export function local(instant: Date | string): { day: string; time: string } {
  const values = Object.fromEntries(
    parts.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return { day: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

/** The instant at which the zone's clock shows `day` `time` (the later one in an autumn repeat). */
export function instantAt(day: string, time: string): Date {
  const wall = Date.parse(`${day}T${time}:00Z`);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const shown = local(new Date(guess));
    const offset = Date.parse(`${shown.day}T${shown.time}:00Z`) - guess;
    guess = wall - offset;
  }
  return new Date(guess);
}

/** Midnight at the start of `day` in the zone. */
export const startOfDay = (day: string) => instantAt(day, "00:00");

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday. */
export const weekdayIndex = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

export const startOfWeek = (day: string) => addDays(day, -weekdayIndex(day));

export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

export function addMonths(day: string, months: number): string {
  const date = new Date(`${startOfMonth(day)}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export const daysInMonth = (day: string) => {
  const date = new Date(`${startOfMonth(day)}T12:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

export const today = (now: Date = new Date()) => local(now).day;

/** A day as a Date at noon UTC: the same calendar day in the zone, for formatting with timeZone ZONE. */
export const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);

export const ISO_WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type Weekday = (typeof ISO_WEEKDAYS)[number];
