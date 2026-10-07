"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { PixelHeadphones, PixelPin, Tag, cn } from "@spot-on-slot/ui";
import { BookingCta, type BookingTarget } from "@/components/bookings/booking-cta";
import { usePriceText, useTermText } from "@/components/listings/listing-time";
import type { ArtistHit, Hit, ListingHit, VenueHit } from "./queries";

/** The id a result is known by on the list and the map. */
export function hitId(hit: Hit): string {
  return hit.tab === "listings" ? hit.hit.id : hit.hit.slug;
}

export function hitHref(hit: Hit): string {
  if (hit.tab === "artists") return `/a/${hit.hit.slug}`;
  if (hit.tab === "venues") return `/v/${hit.hit.slug}`;
  return `/o/${hit.hit.id}`;
}

export function hitTitle(hit: Hit): string {
  if (hit.tab === "artists") return hit.hit.stageName;
  if (hit.tab === "venues") return hit.hit.name;
  return hit.hit.venue?.name ?? hit.hit.artist?.stageName ?? "";
}

/** What a result's booking button answers; venues have none (artists answer their listings). */
function bookingTarget(hit: Hit): BookingTarget | null {
  if (hit.tab === "artists") return { kind: "artist", slug: hit.hit.slug };
  if (hit.tab === "listings") return { kind: "listing", id: hit.hit.id, listingKind: hit.hit.kind };
  return null;
}

/** One result on the list; the card links to the profile or listing, the button under it starts a booking. */
export function ResultCard({ hit, selected }: { hit: Hit; selected: boolean }) {
  const target = bookingTarget(hit);
  return (
    <li
      id={`result-${hitId(hit)}`}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "border-2 bg-card transition-colors",
        selected ? "border-primary shadow-[4px_4px_0_0_var(--color-primary)]" : "border-border",
      )}
    >
      <Link
        href={hitHref(hit)}
        className="flex gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {hit.tab === "artists" ? (
          <ArtistBody hit={hit.hit} />
        ) : hit.tab === "venues" ? (
          <VenueBody hit={hit.hit} />
        ) : (
          <ListingBody hit={hit.hit} />
        )}
      </Link>
      {target && (
        <div className="flex justify-end px-3 pb-3 empty:hidden">
          <BookingCta target={target} size="sm" />
        </div>
      )}
    </li>
  );
}

function Thumb({ src, kind }: { src?: string; kind: "artist" | "venue" }) {
  return (
    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-muted">
      {src ? (
        // Variants are small public WebP files; next/image would only proxy them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : kind === "artist" ? (
        <PixelHeadphones className="size-8 text-primary" />
      ) : (
        <PixelPin className="size-8 text-highlight" />
      )}
    </div>
  );
}

function Distance({ km }: { km: number }) {
  const t = useTranslations("search");
  const format = useFormatter();
  return (
    <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
      {t("distance", { km: format.number(km, { maximumFractionDigits: 1 }) })}
    </span>
  );
}

function Genres({ genres }: { genres: string[] }) {
  const t = useTranslations();
  return (
    <span className="flex flex-wrap gap-1">
      {genres.map((genre) => (
        <Tag key={genre} className="text-[0.625rem]">
          {t(`genres.${genre}` as "genres.TECHNO")}
        </Tag>
      ))}
    </span>
  );
}

function Head({ title, km }: { title: string; km: number }) {
  return (
    <span className="flex items-start justify-between gap-2">
      <span className="font-bold uppercase break-words">{title}</span>
      <Distance km={km} />
    </span>
  );
}

function ArtistBody({ hit }: { hit: ArtistHit }) {
  const t = useTranslations("search");
  const price = usePriceText();
  return (
    <>
      <Thumb src={hit.avatar?.small} kind="artist" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Head title={hit.stageName} km={hit.distanceKm} />
        <span className="text-xs text-muted-foreground">{t("approximate", { city: hit.city })}</span>
        <Genres genres={hit.genres} />
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>{price(hit.rateFrom, hit.rateTo)}</span>
          <span>{t("travel", { km: hit.travelRadiusKm })}</span>
        </span>
      </span>
    </>
  );
}

function VenueBody({ hit }: { hit: VenueHit }) {
  const t = useTranslations();
  return (
    <>
      <Thumb src={hit.avatar?.small} kind="venue" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Head title={hit.name} km={hit.distanceKm} />
        <span className="text-xs text-muted-foreground">
          {[t(`venueTypes.${hit.type}`), hit.city].filter(Boolean).join(" · ")}
        </span>
        <Genres genres={hit.genres} />
        {hit.capacity != null && <span className="text-xs">{t("search.capacity", { count: hit.capacity })}</span>}
      </span>
    </>
  );
}

function ListingBody({ hit }: { hit: ListingHit }) {
  const t = useTranslations();
  const term = useTermText();
  const price = usePriceText();
  const author = hit.venue?.name ?? hit.artist?.stageName ?? "";
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-2">
        <Tag
          className={cn(
            "text-[0.625rem]",
            hit.kind === "VENUE_SEEKING" ? "border-highlight bg-highlight text-highlight-foreground" : "",
          )}
        >
          {t(`listings.kind.${hit.kind}`)}
        </Tag>
        <span className="text-xs font-bold uppercase tabular-nums">{term(hit.startsAt, hit.endsAt)}</span>
      </span>
      <Head title={author} km={hit.distanceKm} />
      <Genres genres={hit.genres} />
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>{price(hit.priceFrom, hit.priceTo)}</span>
        {hit.city != null && (
          <span>
            {hit.travelRadiusKm != null
              ? t("listings.cityRadius", { city: hit.city, km: hit.travelRadiusKm })
              : hit.city}
          </span>
        )}
      </span>
      {hit.description && <span className="line-clamp-2 text-sm break-words">{hit.description}</span>}
    </span>
  );
}
