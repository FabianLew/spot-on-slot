export const USER_ROLES = ["ARTIST", "BOOKER", "VENUE", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
