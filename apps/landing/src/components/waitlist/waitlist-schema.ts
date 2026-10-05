import { z } from "zod";

export const WAITLIST_ROLES = ["ARTIST", "BOOKER", "VENUE"] as const;

export const waitlistSchema = z.object({
  email: z.email({ error: "validation.emailInvalid" }),
  role: z.enum(WAITLIST_ROLES, { error: "validation.roleRequired" }),
  city: z.string().trim().min(2, { error: "validation.cityRequired" }).max(100),
  // A boolean refined to true (not z.literal(true)) so the form can start with the box unchecked.
  consent: z.boolean().refine((checked) => checked, { error: "validation.consentRequired" }),
  // Honeypot: hidden from people, sent as-is; the backend silently drops filled sign-ups.
  website: z.string().optional(),
});

export type WaitlistValues = z.output<typeof waitlistSchema>;
