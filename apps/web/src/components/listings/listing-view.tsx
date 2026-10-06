import { useTranslations } from "next-intl";
import Link from "next/link";
import { buttonVariants, PageHeader, Panel, Tag } from "@spot-on-slot/ui";
import type { Listing } from "./queries";
import { usePriceText, useTermText } from "./listing-time";

/** A listing as anyone with its link sees it (`/o/[id]`). Server- and client-safe. */
export function ListingView({ listing }: { listing: Listing }) {
  const t = useTranslations();
  const term = useTermText();
  const price = usePriceText();
  const artist = listing.kind === "ARTIST_AVAILABLE";
  const author = artist
    ? listing.artist && { name: listing.artist.stageName, href: `/a/${listing.artist.slug}` }
    : listing.venue && { name: listing.venue.name, href: `/v/${listing.venue.slug}` };

  return (
    <article className="flex flex-col gap-4">
      <PageHeader title={t(`listings.kind.${listing.kind}`)} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Panel>
          <p className="border-2 border-border bg-highlight px-3 py-2 text-base font-bold tabular-nums text-highlight-foreground">
            {term(listing.startsAt, listing.endsAt)}
          </p>
          <ul className="flex flex-wrap gap-1" aria-label={t("listings.genres")}>
            {listing.genres.map((genre) => (
              <li key={genre}>
                <Tag>{t(`genres.${genre}`)}</Tag>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-bold uppercase text-muted-foreground">
              {artist ? t("listings.rate") : t("listings.budget")}
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
          {listing.description && <p className="text-sm whitespace-pre-line break-words">{listing.description}</p>}
        </Panel>
        {author && (
          <Panel title={artist ? t("listings.public.artist") : t("listings.public.venue")} headingLevel={2}>
            <p className="font-display text-xl leading-tight">{author.name}</p>
            <Link href={author.href} className={buttonVariants({ variant: "outline" }) + " self-start"}>
              {t("listings.public.seeProfile")}
            </Link>
            <p className="text-xs text-muted-foreground">{t("listings.public.bookingSoon")}</p>
          </Panel>
        )}
      </div>
    </article>
  );
}
