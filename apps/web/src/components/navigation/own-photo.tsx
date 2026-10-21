"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useArtistProfile, useMyVenues } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";

/**
 * The square beside the wordmark: the account's own main photo (the artist's, or the oldest venue's) linking to the
 * profile, else the plain brand square.
 */
export function OwnPhoto() {
  const t = useTranslations("nav");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  const artist = useArtistProfile(role === "ARTIST");
  const venues = useMyVenues(role === "VENUE");
  const src = role === "ARTIST" ? artist.data?.avatar?.small : role === "VENUE" ? venues.data?.[0]?.avatar?.small : undefined;

  if (!src) return <span aria-hidden="true" className="size-9 shrink-0 bg-heading" />;
  return (
    <Link
      href="/profile"
      aria-label={t("ownProfile")}
      className="size-9 shrink-0 border-2 border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Variants are small public WebP files; next/image would only proxy them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={36} height={36} className="size-full object-cover" />
    </Link>
  );
}
