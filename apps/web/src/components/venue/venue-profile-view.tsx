import type { ApiSchemas } from "@spot-on-slot/api-client";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Panel, PixelNote, PixelPin, Tag } from "@spot-on-slot/ui";
import { ExternalLinks, PhotoGalleryView } from "@/components/profile/public-parts";

type PublicVenue = ApiSchemas["PublicVenueResponse"];

/** What the venue page shows: the public business data, which the team's own view has too (no team). */
export type VenueViewData = Pick<
  PublicVenue,
  "name" | "type" | "description" | "capacity" | "genres" | "tags" | "links" | "avatar" | "photos"
> & { address?: PublicVenue["address"] | null };

export const VENUE_LINKS = ["website", "instagram", "facebook"] as const;

/** One line of a venue address: "Szewska 5, 31-009 Kraków". */
export function addressLine(address: { street: string; postalCode?: string | null; city: string }) {
  return `${address.street}, ${[address.postalCode, address.city].filter(Boolean).join(" ")}`;
}

/**
 * The venue profile in the arcade layout of the "venue panel" mockup. No client hooks, so the public page renders it
 * on the server and the team's preview in the app.
 */
/** `action` (the public page's "Napisz") sits under the name. */
export function VenueProfileView({
  venue,
  headingLevel = 2,
  action,
}: {
  venue: VenueViewData;
  headingLevel?: 1 | 2;
  action?: ReactNode;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const links = VENUE_LINKS.filter((key) => venue.links[key]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start">
        <Panel className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start md:grid-cols-1">
          {venue.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module
            <img
              src={venue.avatar.medium}
              alt={t("venueProfile.view.avatarAlt", { name: venue.name })}
              width={venue.avatar.width}
              height={venue.avatar.height}
              className="aspect-square w-full border-2 border-border object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center border-2 border-border bg-heading dark:bg-background">
              <PixelNote className="w-2/5 text-highlight" />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            <Heading className="font-display text-xl leading-none break-words sm:text-3xl md:text-4xl">
              {venue.name}
            </Heading>
            <div className="flex flex-col gap-1 text-xs uppercase">
              <p>{t(`venueTypes.${venue.type}`)}</p>
              {venue.capacity != null && (
                <p>{t("venueProfile.view.capacity", { capacity: format.number(venue.capacity) })}</p>
              )}
            </div>
            {venue.address && (
              <p className="flex items-start gap-2 text-xs uppercase">
                <PixelPin className="mt-px size-3.5 shrink-0 text-primary dark:text-highlight" />
                <span>{addressLine(venue.address)}</span>
              </p>
            )}
            {(venue.genres.length > 0 || venue.tags.length > 0) && (
              <ul className="flex flex-wrap gap-2">
                {venue.genres.map((genre) => (
                  <li key={genre}>
                    <Tag>{t(`genres.${genre}`)}</Tag>
                  </li>
                ))}
                {venue.tags.map((tag) => (
                  <li key={`tag-${tag}`}>
                    <Tag className="bg-transparent">#{tag}</Tag>
                  </li>
                ))}
              </ul>
            )}
            {action}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title={t("venueProfile.view.about")} headingLevel={3}>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {venue.description || (
                <span className="text-muted-foreground">{t("venueProfile.view.noDescription")}</span>
              )}
            </p>
          </Panel>
          <ExternalLinks
            title={t("venueProfile.view.links")}
            links={links.map((key) => ({
              key,
              href: venue.links[key]!,
              label: t(`venueProfile.view.linkNames.${key}`),
            }))}
          />
        </div>
      </div>
      <PhotoGalleryView
        title={t("venueProfile.view.gallery")}
        photos={venue.photos}
        alt={(index, total) => t("venueProfile.view.photoAlt", { index, total })}
      />
    </div>
  );
}
