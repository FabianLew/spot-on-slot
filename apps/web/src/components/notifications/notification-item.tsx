"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Tag, cn } from "@spot-on-slot/ui";
import { useAmountText } from "@/components/bookings/booking-text";
import { usePriceText, useTermText } from "@/components/listings/listing-time";
import type { AppNotification, BookingNotice, NearbyListing } from "./queries";

/** One notification; opening it marks it read. Listings that ended stay in the list, greyed out. */
export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
}) {
  const alert = notification.nearbyListing;
  const booking = notification.booking;
  if (!alert && !booking) return null;
  const unread = notification.readAt == null;
  return (
    <li>
      <Link
        href={booking ? `/bookings/${booking.bookingId}` : `/o/${alert!.listingId}`}
        onClick={() => onOpen(notification)}
        data-unread={unread}
        className={cn(
          "flex flex-col gap-2 border-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          unread ? "border-primary bg-card" : "border-border",
          !notification.active && "border-dashed opacity-60",
        )}
      >
        {booking ? (
          <BookingSummary booking={booking} unread={unread} />
        ) : (
          <NearbyListingSummary
            alert={alert!}
            unread={unread}
            active={notification.active}
          />
        )}
      </Link>
    </li>
  );
}

function NearbyListingSummary({
  alert,
  unread,
  active,
}: {
  alert: NearbyListing;
  unread: boolean;
  active: boolean;
}) {
  const t = useTranslations("notifications");
  const tGenres = useTranslations("genres");
  const term = useTermText();
  const price = usePriceText();
  const where =
    alert.venueName != null
      ? t(alert.city != null ? "distanceVenue" : "distanceVenueNoCity", {
          city: alert.city ?? "",
          km: alert.distanceKm,
          venue: alert.venueName,
        })
      : t(alert.city != null ? "distanceSelf" : "distanceSelfNoCity", {
          city: alert.city ?? "",
          km: alert.distanceKm,
        });
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-bold">
          {t(`nearby.${alert.kind}`, { name: alert.authorName })}
        </p>
        <span className="flex gap-1">
          {unread && (
            <Tag className="border-primary bg-primary text-[0.625rem] text-primary-foreground">
              {t("unreadTag")}
            </Tag>
          )}
          {!active && (
            <Tag className="bg-transparent text-[0.625rem] text-muted-foreground">
              {t("inactive")}
            </Tag>
          )}
        </span>
      </div>
      <p className="text-sm font-bold uppercase tabular-nums">
        {term(alert.startsAt, alert.endsAt)}
      </p>
      <p className="text-xs text-muted-foreground">
        {where} · {alert.genres.map((genre) => tGenres(genre)).join(", ")} ·{" "}
        {price(alert.priceFrom, alert.priceTo)}
      </p>
      {alert.free === true && active && (
        <Tag className="self-start border-highlight bg-highlight text-[0.625rem] text-highlight-foreground">
          {t("free")}
        </Tag>
      )}
    </>
  );
}

/** A step of one of the viewer's bookings, told from their side: who did what, when, for how much. */
function BookingSummary({ booking, unread }: { booking: BookingNotice; unread: boolean }) {
  const t = useTranslations("notifications");
  const term = useTermText();
  const amount = useAmountText();
  const key =
    booking.kind === "REQUESTED" || (booking.kind === "DECLINED" && booking.by === "SYSTEM")
      ? `${booking.kind}_${booking.by}`
      : booking.kind;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-bold">
          {t(`booking.${key}` as "booking.ACCEPTED", { name: booking.otherName })}
        </p>
        {unread && (
          <Tag className="border-primary bg-primary text-[0.625rem] text-primary-foreground">
            {t("unreadTag")}
          </Tag>
        )}
      </div>
      <p className="text-sm font-bold uppercase tabular-nums">
        {term(booking.startsAt, booking.endsAt)}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("bookingTag")} · {amount(booking.amount)}
      </p>
    </>
  );
}
