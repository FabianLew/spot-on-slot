"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@spot-on-slot/ui";
import { useTermText } from "@/components/listings/listing-time";
import { otherSide, StatusTag, useAmountText, useExpiresText } from "./booking-text";
import type { Booking } from "./queries";

/** One booking on the list; the whole card opens its details. */
export function BookingCard({ booking }: { booking: Booking }) {
  const t = useTranslations("bookings");
  const term = useTermText();
  const amount = useAmountText();
  const expires = useExpiresText();
  const side = otherSide(booking);
  const when = term(booking.startsAt, booking.endsAt);
  const open = booking.status === "PENDING" || booking.status === "ACCEPTED";

  return (
    <li
      data-status={booking.status}
      className={cn(
        "border-2 bg-card",
        booking.myTurn ? "border-primary" : open ? "border-border" : "border-dashed border-border bg-transparent",
      )}
    >
      <Link
        href={`/bookings/${booking.id}`}
        aria-label={t("detailsOf", { name: side.name, when })}
        className="flex flex-col gap-2 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="font-bold uppercase break-words">{side.name}</span>
          <StatusTag booking={booking} />
        </span>
        <span className="text-sm font-bold uppercase tabular-nums">{when}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>{amount(booking.amount)}</span>
          {booking.respondBy != null && (
            <span className="text-muted-foreground">{t("expires", { when: expires(booking.respondBy) })}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
