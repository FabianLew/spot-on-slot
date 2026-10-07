"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormRootError,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { showServerError } from "@/components/auth/server-error";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useTermText } from "@/components/listings/listing-time";
import { useArtistProfile, useMyVenues } from "@/components/onboarding/queries";
import type { Venue } from "@/components/onboarding/profile-requests";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { BookingFields } from "./booking-fields";
import { bookingSchema, toTerms, toValues, type BookingValues, type Term } from "./booking-form-values";
import { BOOKINGS } from "./queries";

type PublicArtist = ApiSchemas["PublicProfileResponse"];
type PublicListing = ApiSchemas["ListingResponse"];

/** How far ahead a venue picks the artist's free time from (public reads cover at most 92 days). */
export const PICK_DAYS = 90;

/** Where the booking starts: an artist's profile or a listing. */
export type NewBookingSource = { artist: string } | { listing: string };

/** `/bookings/new`: a venue's request to an artist, or an artist's application to a venue's listing. */
export function NewBookingScreen({ source }: { source: NewBookingSource | null }) {
  const t = useTranslations("bookings.new");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  const listing = usePublicListing(source && "listing" in source ? source.listing : undefined);
  const artistSlug =
    source && "artist" in source ? source.artist : listing.data?.kind === "ARTIST_AVAILABLE" ? listing.data.artist?.slug : undefined;
  const venueAsks = source != null && ("artist" in source || listing.data?.kind === "ARTIST_AVAILABLE");

  const title =
    source && "listing" in source && listing.data?.kind === "VENUE_SEEKING" ? t("artistTitle") : t("venueTitle");
  let body;
  if (source == null || listing.data === null) body = <Note text={t("notFound")} />;
  else if (listing.isPending && "listing" in source) body = <Panel aria-busy="true" className="h-40" />;
  else if (listing.isError) body = <ApiErrorState error={listing.error} onRetry={() => listing.refetch()} />;
  else if (venueAsks && role !== "VENUE") body = <Note text={t("venuesOnly")} />;
  else if (!venueAsks && role !== "ARTIST") body = <Note text={t("artistsOnly")} />;
  else if (venueAsks) body = <VenueRequest slug={artistSlug} listing={listing.data ?? undefined} />;
  else body = <ArtistApplication listing={listing.data!} />;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={title} />
      {body}
    </section>
  );
}

function usePublicListing(id: string | undefined) {
  return useQuery({
    enabled: id != null,
    queryKey: ["listings", "public", id],
    queryFn: async (): Promise<PublicListing | null> => {
      const result = await api.GET("/api/v1/public/listings/{id}", { params: { path: { id: id! } } });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });
}

function Note({ text, href, link }: { text: string; href?: string; link?: string }) {
  return (
    <Panel>
      <p className="text-sm">{text}</p>
      {href && link && (
        <Button asChild variant="outline" className="self-start">
          <Link href={href}>{link}</Link>
        </Button>
      )}
    </Panel>
  );
}

/** A venue asks: pick one of its published venues, then the time (from the artist's free time or the listing). */
function VenueRequest({ slug, listing }: { slug?: string; listing?: PublicListing }) {
  const t = useTranslations("bookings.new");
  const venues = useMyVenues();
  const artist = useQuery({
    enabled: slug != null,
    queryKey: ["artists", "public", slug],
    queryFn: async (): Promise<PublicArtist | null> => {
      const result = await api.GET("/api/v1/public/artists/{slug}", { params: { path: { slug: slug! } } });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });
  const [chosen, setChosen] = useState<string>();
  const published = (venues.data ?? []).filter((venue) => venue.published);
  const venue = published.find((item) => item.id === chosen) ?? published[0];

  if (slug == null || artist.data === null) return <Note text={t("notFound")} />;
  if (venues.isPending || artist.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (venues.isError) return <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />;
  if (artist.isError) return <ApiErrorState error={artist.error} onRetry={() => artist.refetch()} />;
  if (venues.data.length === 0) return <Note text={t("noVenue")} href="/onboarding" link={t("goProfile")} />;
  if (!venue) {
    return <Note text={t("venueNotPublished")} href={`/profile?venue=${venues.data[0]!.id}`} link={t("goProfile")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <p className="font-display text-xl leading-tight">{t("to", { name: artist.data.stageName })}</p>
        {published.length > 1 ? (
          <div className="flex min-w-56 flex-col gap-2 self-start">
            <label htmlFor="booking-venue" className="text-sm font-bold uppercase">
              {t("venue")}
            </label>
            <Select value={venue.id} onValueChange={setChosen}>
              <SelectTrigger id="booking-venue" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {published.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("venue")}: {venue.name}
          </p>
        )}
      </Panel>
      {listing ? (
        <RequestForm
          venue={venue}
          slug={slug}
          listingId={listing.id}
          within={{ startsAt: listing.startsAt, endsAt: listing.endsAt }}
          amount={listing.priceFrom ?? listing.priceTo}
        />
      ) : (
        <FreeTimeRequest venue={venue} slug={slug} amount={artist.data.rate?.from ?? artist.data.rate?.to} />
      )}
    </div>
  );
}

/** From a profile: the artist's free time first, then the form within it. */
function FreeTimeRequest({ venue, slug, amount }: { venue: Venue; slug: string; amount?: number | null }) {
  const t = useTranslations("bookings.new");
  const termText = useTermText();
  const [range] = useState(() => {
    const now = new Date();
    return { from: now, to: new Date(now.getTime() + PICK_DAYS * 86_400_000) };
  });
  const [term, setTerm] = useState<Term | null>(null);
  const calendar = useQuery({
    queryKey: ["availability", "public", slug, range.from.toISOString()],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/public/artists/{slug}/availability", {
          params: { path: { slug }, query: { from: range.from.toISOString(), to: range.to.toISOString() } },
        }),
      ),
  });
  const free = useMemo(
    () => (calendar.data ?? []).filter((entry) => entry.status === "FREE" && new Date(entry.startsAt) > range.from),
    [calendar.data, range.from],
  );

  if (term) {
    return (
      <RequestForm
        key={term.startsAt}
        venue={venue}
        slug={slug}
        within={term}
        amount={amount}
        onChangeTerm={() => setTerm(null)}
      />
    );
  }
  return (
    <Panel title={t("pickTitle")} headingLevel={2}>
      {calendar.isPending ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : calendar.isError ? (
        <ApiErrorState error={calendar.error} onRetry={() => calendar.refetch()} />
      ) : free.length === 0 ? (
        <p className="text-sm">{t("noFree")}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("pickHint")}</p>
          <ul aria-label={t("pickTitle")} className="flex flex-col gap-2">
            {free.map((entry) => (
              <li key={entry.startsAt}>
                <button
                  type="button"
                  onClick={() => setTerm({ startsAt: entry.startsAt, endsAt: entry.endsAt })}
                  className="w-full border-2 border-border bg-highlight px-3 py-2 text-left text-sm font-bold tabular-nums text-highlight-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {termText(entry.startsAt, entry.endsAt)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function RequestForm({
  venue,
  slug,
  listingId,
  within,
  amount,
  onChangeTerm,
}: {
  venue: Venue;
  slug: string;
  listingId?: string;
  within: Term;
  amount?: number | null;
  onChangeTerm?: () => void;
}) {
  const t = useTranslations();
  const termText = useTermText();
  const send = useSend("bookings.new.sent");
  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema(within)),
    defaultValues: toValues(within, amount),
  });

  return (
    <Panel>
      <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) =>
            send(form, {
              venueId: venue.id,
              ...(listingId ? { listingId } : { artistSlug: slug }),
              ...toTerms(values),
            }),
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-border bg-highlight px-3 py-2 text-highlight-foreground">
            <p className="text-sm font-bold tabular-nums">
              {t(listingId ? "bookings.new.listingWithin" : "bookings.new.within", {
                term: termText(within.startsAt, within.endsAt),
              })}
            </p>
            {onChangeTerm && (
              <Button type="button" size="sm" variant="outline" onClick={onChangeTerm}>
                {t("bookings.new.changeTerm")}
              </Button>
            )}
          </div>
          <BookingFields form={form} placeholder={t("bookings.new.venuePlaceholder")} />
          <FormRootError />
          <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("bookings.new.sending") : t("bookings.new.send")}
          </Button>
        </form>
      </Form>
    </Panel>
  );
}

/** An artist applies: the listing's time, their own fee and message. */
function ArtistApplication({ listing }: { listing: PublicListing }) {
  const t = useTranslations();
  const termText = useTermText();
  const profile = useArtistProfile();
  const send = useSend("bookings.new.applied");
  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema()),
    defaultValues: toValues(listing, listing.priceTo ?? listing.priceFrom),
  });
  const rateFrom = profile.data?.rate?.from;
  const budget = listing.priceTo ?? listing.priceFrom;
  // Without a budget the fee starts from the artist's own rate, once the profile has loaded.
  useEffect(() => {
    if (budget == null && rateFrom != null && form.getValues("amount") === "") {
      form.setValue("amount", toValues(listing, rateFrom).amount);
    }
  }, [budget, rateFrom, form, listing]);

  if (profile.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  if (!profile.data?.published) {
    return (
      <Note
        text={t("bookings.new.artistNotPublished")}
        href={profile.data ? "/profile" : "/onboarding"}
        link={t("bookings.new.goProfile")}
      />
    );
  }
  return (
    <Panel>
      {listing.venue && (
        <p className="font-display text-xl leading-tight">{t("bookings.new.to", { name: listing.venue.name })}</p>
      )}
      <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => {
            const { amount, message } = toTerms(values);
            return send(form, { listingId: listing.id, amount, message });
          })}
        >
          <p className="border-2 border-border bg-highlight px-3 py-2 text-sm font-bold tabular-nums text-highlight-foreground">
            <span className="sr-only">{t("bookings.new.listingTerm")}: </span>
            {termText(listing.startsAt, listing.endsAt)}
          </p>
          <BookingFields form={form} time={false} placeholder={t("bookings.new.artistPlaceholder")} />
          <FormRootError />
          <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("bookings.new.sending") : t("bookings.new.sendApplication")}
          </Button>
        </form>
      </Form>
    </Panel>
  );
}

/** Sends the new booking and opens it; server errors land on the form. */
function useSend(done: "bookings.new.sent" | "bookings.new.applied") {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  return async (form: ReturnType<typeof useForm<BookingValues>>, body: ApiSchemas["CreateBookingRequest"]) => {
    try {
      const booking = unwrap(await api.POST("/api/v1/bookings", { body }));
      await queryClient.invalidateQueries({ queryKey: BOOKINGS });
      toast.success(t(done));
      router.push(`/bookings/${booking.id}`);
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  };
}
