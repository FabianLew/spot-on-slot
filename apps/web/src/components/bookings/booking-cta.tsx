"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { buttonVariants, cn } from "@spot-on-slot/ui";
import { useSession } from "@/components/session/session-provider";

/** What the button answers: an artist's profile, or a listing of either kind. */
export type BookingTarget =
  | { kind: "artist"; slug: string }
  | { kind: "listing"; id: string; listingKind: "ARTIST_AVAILABLE" | "VENUE_SEEKING" };

/** The role that can answer `target`: venues ask artists, artists apply to venues' listings. */
const roleFor = (target: BookingTarget) =>
  target.kind === "listing" && target.listingKind === "VENUE_SEEKING" ? "ARTIST" : "VENUE";

export function bookingHref(target: BookingTarget) {
  return target.kind === "artist"
    ? `/bookings/new?artist=${encodeURIComponent(target.slug)}`
    : `/bookings/new?listing=${encodeURIComponent(target.id)}`;
}

/**
 * "Zapytaj o termin" / "Zapytaj o booking" / "Zgłoś się". Signed-in accounts see it only when their role can use it;
 * anyone else follows it through the login page (the bookings pages require a session).
 */
export function BookingCta({ target, size, className }: { target: BookingTarget; size?: "sm"; className?: string }) {
  const t = useTranslations("bookings.cta");
  const { session } = useSession();
  if (session.status === "authenticated" && session.user.role !== roleFor(target)) return null;
  const label =
    target.kind === "artist" ? t("ask") : target.listingKind === "VENUE_SEEKING" ? t("apply") : t("askListing");
  return (
    <Link href={bookingHref(target)} className={cn(buttonVariants({ size }), className)}>
      {label}
    </Link>
  );
}
