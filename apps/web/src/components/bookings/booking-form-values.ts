import { z } from "zod";
import { addDays, instantAt, local } from "@/components/calendar/warsaw-time";
import { endsNextDay } from "@/components/listings/listing-form-values";
import { zl } from "@/components/listings/listing-time";

export const MAX_MESSAGE = 1000;
const MAX_AMOUNT_ZL = 100_000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_MINUTES = 30;
const MAX_MINUTES = 24 * 60;

/** A stretch of time as the API sends it. */
export type Term = { startsAt: string; endsAt: string };

// Mirrors the backend rules (booking CreateBookingRequest / CounterRequest); the server stays the authority.
const baseSchema = z.object({
  date: z.string().min(1, "validation.required"),
  from: z.string().regex(TIME, "validation.time"),
  to: z.string().regex(TIME, "validation.time"),
  amount: z
    .string()
    .trim()
    .min(1, "validation.required")
    .refine((value) => value === "" || /^\d+$/.test(value), "validation.number")
    .refine((value) => !/^\d+$/.test(value) || Number(value) <= MAX_AMOUNT_ZL, "validation.rateMax"),
  message: z.string().trim().max(MAX_MESSAGE, "validation.tooLong"),
});

export type BookingValues = z.infer<typeof baseSchema>;

/** The values' time as instants; an end at or before the start means the next day. */
export function toTerm(values: Pick<BookingValues, "date" | "from" | "to">): Term {
  const endDay = endsNextDay(values.from, values.to) ? addDays(values.date, 1) : values.date;
  return {
    startsAt: instantAt(values.date, values.from).toISOString(),
    endsAt: instantAt(endDay, values.to).toISOString(),
  };
}

/** The form's checks; with `within`, the time must stay inside it (a venue narrowing the artist's free time). */
export function bookingSchema(within?: Term) {
  return baseSchema.superRefine((values, ctx) => {
    if (!values.date || !TIME.test(values.from) || !TIME.test(values.to)) return;
    const term = toTerm(values);
    const minutes = (Date.parse(term.endsAt) - Date.parse(term.startsAt)) / 60_000;
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "validation.duration" });
    } else if (
      within &&
      (Date.parse(term.startsAt) < Date.parse(within.startsAt) || Date.parse(term.endsAt) > Date.parse(within.endsAt))
    ) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "validation.outsideFree" });
    }
  });
}

/** Form values for `term` with `amount` in grosze (null leaves the amount empty). */
export function toValues(term: Term, amount: number | null | undefined, message = ""): BookingValues {
  const start = local(term.startsAt);
  const end = local(term.endsAt);
  return {
    date: start.day,
    from: start.time,
    to: end.time,
    amount: amount != null ? String(zl(amount)) : "",
    message,
  };
}

/** Złote typed in the form as grosze. */
export const toGrosze = (value: string) => Number(value.trim()) * 100;

/** What the request, application or counteroffer sends. */
export function toTerms(values: BookingValues) {
  return { ...toTerm(values), amount: toGrosze(values.amount), message: values.message.trim() || undefined };
}
