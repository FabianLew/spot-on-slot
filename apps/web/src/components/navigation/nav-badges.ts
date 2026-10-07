"use client";

import { useTranslations } from "next-intl";
import { useAwaitingCount } from "@/components/bookings/queries";
import { useUnreadConversations } from "@/components/messages/queries";
import { useSession } from "@/components/session/session-provider";
import type { NavBadgeName } from "./nav-items";

export type NavBadge = { count: number; label: string };

/** Only artists and venues have bookings and conversations. */
function useParty() {
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  return role === "ARTIST" || role === "VENUE";
}

/** Bookings waiting for the account's answer. */
function useBookingsBadge(enabled: boolean): NavBadge | null {
  const t = useTranslations("bookings");
  const party = useParty();
  const count = useAwaitingCount(enabled && party).data ?? 0;
  return count > 0 ? { count, label: t("badge", { count }) } : null;
}

/** Conversations with unread messages; the live connection refreshes it as messages arrive. */
function useMessagesBadge(enabled: boolean): NavBadge | null {
  const t = useTranslations("messages");
  const party = useParty();
  const count = useUnreadConversations(enabled && party).data ?? 0;
  return count > 0 ? { count, label: t("badge", { count }) } : null;
}

/** The counter of a navigation entry, or null when there is nothing to show. */
export function useNavBadge(name: NavBadgeName | undefined): NavBadge | null {
  // Every hook always runs; each is disabled for entries without its badge.
  const bookings = useBookingsBadge(name === "bookings");
  const messages = useMessagesBadge(name === "messages");
  return name === "bookings" ? bookings : name === "messages" ? messages : null;
}
