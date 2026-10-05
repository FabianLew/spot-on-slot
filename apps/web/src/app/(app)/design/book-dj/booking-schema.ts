import { z } from "zod";

const required = { error: "validation.required" };

export const bookingSchema = z.object({
  venueName: z.string(required).trim().min(1, required),
  location: z.string(required).trim().min(1, required),
  date: z.string(required).min(1, required),
  time: z.string(required).min(1, required),
});

export type BookingValues = z.infer<typeof bookingSchema>;
