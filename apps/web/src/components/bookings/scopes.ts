/** The tab's filters: waiting for my answer, in negotiation, accepted and not played yet, everything closed. */
export const BOOKING_SCOPES = ["awaiting", "pending", "upcoming", "history"] as const;
export type BookingScope = (typeof BOOKING_SCOPES)[number];

/** Whether an address parameter names a filter; the page (a server component) checks `?scope=` with it. */
export const isScope = (value: unknown): value is BookingScope =>
  typeof value === "string" && (BOOKING_SCOPES as readonly string[]).includes(value);
