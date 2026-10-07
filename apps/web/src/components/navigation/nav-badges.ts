"use client";

import { useTranslations } from "next-intl";
import { useAwaitingCount } from "@/components/bookings/queries";
import { useSession } from "@/components/session/session-provider";
import type { NavBadgeName } from "./nav-items";

export type NavBadge = { count: number; label: string };

/** Bookings waiting for the account's answer; only artists and venues have bookings. */
function useBookingsBadge(enabled: boolean): NavBadge | null {
  const t = useTranslations("bookings");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  const count = useAwaitingCount(enabled && (role === "ARTIST" || role === "VENUE")).data ?? 0;
  return count > 0 ? { count, label: t("badge", { count }) } : null;
}

/** The counter of a navigation entry, or null when there is nothing to show. */
export function useNavBadge(name: NavBadgeName | undefined): NavBadge | null {
  // One badge kind so far; the hook always runs and is disabled for entries without it.
  const bookings = useBookingsBadge(name === "bookings");
  return name === "bookings" ? bookings : null;
}
