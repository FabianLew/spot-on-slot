"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Tag, cn } from "@spot-on-slot/ui";
import { zl } from "@/components/listings/listing-time";
import type { Booking, BookingStatus } from "./queries";

/** "1500 zł", or "Bez honorarium" for 0. */
export function useAmountText() {
  const t = useTranslations("bookings");
  const format = useFormatter();
  return (grosze: number) => (grosze === 0 ? t("unpaid") : t("amount", { amount: format.number(zl(grosze)) }));
}

/** The side the viewer deals with: the venue for an artist, the artist for a venue's team. */
export function otherSide(booking: Booking): { name: string; href?: string } {
  return booking.myParty === "ARTIST"
    ? { name: booking.venue.name, href: booking.venue.slug ? `/v/${booking.venue.slug}` : undefined }
    : { name: booking.artist.stageName, href: booking.artist.slug ? `/a/${booking.artist.slug}` : undefined };
}

const OPEN: BookingStatus[] = ["PENDING", "ACCEPTED"];

/** The status, and for a pending booking whose turn it is. */
export function StatusTag({ booking }: { booking: Booking }) {
  const t = useTranslations("bookings");
  const pending = booking.status === "PENDING";
  return (
    <Tag
      className={cn(
        "text-[0.625rem]",
        pending && booking.myTurn
          ? "border-primary bg-primary text-primary-foreground"
          : OPEN.includes(booking.status)
            ? "border-highlight bg-highlight text-highlight-foreground"
            : "bg-transparent text-muted-foreground",
      )}
    >
      {pending ? (booking.myTurn ? t("yourTurn") : t("theirTurn")) : t(`status.${booking.status}`)}
    </Tag>
  );
}

/** "za 2 dni" until the booking expires unanswered. */
export function useExpiresText() {
  const format = useFormatter();
  return (respondBy: string, now = new Date()) => format.relativeTime(new Date(respondBy), now);
}
