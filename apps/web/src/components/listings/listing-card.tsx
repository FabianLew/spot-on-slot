"use client";

import { CalendarCheck, Copy, CopyPlus, ExternalLink, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, Tag, toast } from "@spot-on-slot/ui";
import type { Listing } from "./queries";
import { usePriceText, useTermText } from "./listing-time";

/** One of the author's own listings with its actions. */
export function ListingCard({
  listing,
  onEdit,
  onCopy,
  onClose,
  closing,
}: {
  listing: Listing;
  onEdit: () => void;
  onCopy: () => void;
  onClose: () => void;
  closing: boolean;
}) {
  const t = useTranslations();
  const term = useTermText();
  const price = usePriceText();
  const active = listing.status === "ACTIVE";
  const path = `/o/${listing.id}`;
  const when = term(listing.startsAt, listing.endsAt);

  async function copyLink() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("profileStatus.copied"));
    } catch {
      toast.error(t("profileStatus.copyFailed", { url }));
    }
  }

  return (
    <li
      data-status={listing.status}
      className={
        "flex flex-col gap-3 border-2 p-4 " + (active ? "border-border bg-card" : "border-dashed border-border")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-bold uppercase tabular-nums">{when}</p>
        <Tag
          className={
            "text-[0.625rem] " +
            (active
              ? "border-highlight bg-highlight text-highlight-foreground"
              : "bg-transparent text-muted-foreground")
          }
        >
          {t(`listings.status.${listing.status}`)}
        </Tag>
      </div>
      <ul className="flex flex-wrap gap-1" aria-label={t("listings.genres")}>
        {listing.genres.map((genre) => (
          <li key={genre}>
            <Tag className="text-[0.625rem]">{t(`genres.${genre}`)}</Tag>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-bold uppercase text-muted-foreground">
          {listing.kind === "ARTIST_AVAILABLE" ? t("listings.rate") : t("listings.budget")}
        </dt>
        <dd>{price(listing.priceFrom, listing.priceTo)}</dd>
        {listing.city != null && (
          <>
            <dt className="font-bold uppercase text-muted-foreground">{t("listings.place")}</dt>
            <dd>
              {listing.travelRadiusKm != null
                ? t("listings.cityRadius", { city: listing.city, km: listing.travelRadiusKm })
                : listing.city}
            </dd>
          </>
        )}
      </dl>
      {listing.description && <p className="line-clamp-3 text-sm break-words">{listing.description}</p>}
      <div className="flex flex-wrap gap-2">
        {active ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEdit}
              aria-label={t("listings.editAt", { when })}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {t("listings.edit")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={closing}
              aria-label={t("listings.closeAt", { when })}
              onClick={() => {
                if (window.confirm(t("listings.closeConfirm", { when }))) onClose();
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
              {t("listings.close")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copyLink}>
              <Copy className="size-3.5" aria-hidden="true" />
              {t("profileStatus.copyLink")}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={path} target="_blank">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {t("listings.open")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCopy}
              aria-label={t("listings.similarAt", { when })}
            >
              <CopyPlus className="size-3.5" aria-hidden="true" />
              {t("listings.similar")}
            </Button>
            {listing.bookingId != null && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/bookings/${listing.bookingId}`}>
                  <CalendarCheck className="size-3.5" aria-hidden="true" />
                  {t("listings.seeBooking")}
                </Link>
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
