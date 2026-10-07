"use client";

import { useFormatter } from "next-intl";
import { ZONE } from "@/components/calendar/warsaw-time";

/** "21 października 2026" for the moment an account is deleted for good. */
export function useDeletionDate(): (iso: string) => string {
  const format = useFormatter();
  return (iso) => format.dateTime(new Date(iso), { dateStyle: "long", timeZone: ZONE });
}
