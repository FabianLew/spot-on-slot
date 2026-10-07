"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useMyVenues } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { BookingCard } from "./booking-card";
import { useAwaitingCount, useBookings } from "./queries";
import { BOOKING_SCOPES, type BookingScope } from "./scopes";

const ALL = "all";

const hrefOf = (scope: BookingScope, venueId?: string) =>
  `/bookings?scope=${scope}${venueId ? `&venue=${encodeURIComponent(venueId)}` : ""}`;

/** The "Bookingi" tab: the account's bookings by filter; a venue account can narrow them to one venue. */
export function BookingsScreen({ scope, venueId }: { scope?: BookingScope; venueId?: string }) {
  const t = useTranslations("bookings");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  const party = role === "ARTIST" || role === "VENUE";
  const awaiting = useAwaitingCount(party && scope == null);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      {!party ? (
        <Panel>
          <p className="text-sm">{t("otherRole")}</p>
        </Panel>
      ) : scope == null && awaiting.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : (
        <BookingsBody
          role={role}
          // Without a chosen filter: "Czeka na mnie" when something waits, else everything in negotiation.
          scope={scope ?? ((awaiting.data ?? 0) > 0 ? "awaiting" : "pending")}
          venueId={venueId}
        />
      )}
    </section>
  );
}

function BookingsBody({ role, scope, venueId }: { role: string; scope: BookingScope; venueId?: string }) {
  const t = useTranslations("bookings");
  const router = useRouter();
  const venues = useMyVenues(role === "VENUE");
  const list = role === "VENUE" ? (venues.data ?? []) : [];
  const venue = list.find((item) => item.id === venueId)?.id;
  const bookings = useBookings(scope, venue);

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label={t("filter")} className="flex flex-wrap">
          {BOOKING_SCOPES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={scope === option}
              onClick={() => router.replace(hrefOf(option, venue), { scroll: false })}
              className={
                "-mr-0.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (scope === option ? "border-primary bg-primary text-primary-foreground" : "bg-field hover:bg-muted")
              }
            >
              {t(`scopes.${option}`)}
            </button>
          ))}
        </div>
        {list.length > 1 && (
          <div className="flex min-w-56 flex-col gap-2 sm:ml-auto">
            <label htmlFor="booking-venue-switch" className="text-sm font-bold uppercase">
              {t("venueSwitch")}
            </label>
            <Select
              value={venue ?? ALL}
              onValueChange={(id) => router.replace(hrefOf(scope, id === ALL ? undefined : id), { scroll: false })}
            >
              <SelectTrigger id="booking-venue-switch" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allVenues")}</SelectItem>
                {list.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {bookings.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : bookings.isError ? (
        <ApiErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
      ) : bookings.data.pages[0]!.bookings.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">{t(`empty.${scope}`)}</p>
          <p className="text-sm">{role === "VENUE" ? t("startVenue") : t("startArtist")}</p>
          <Button asChild variant="outline" className="self-start">
            <Link href={role === "VENUE" ? "/search?tab=artists" : "/search?tab=listings&kind=VENUE_SEEKING"}>
              {t("goSearch")}
            </Link>
          </Button>
        </Panel>
      ) : (
        <>
          <ul aria-label={t(`scopes.${scope}`)} className="grid gap-3 md:grid-cols-2">
            {bookings.data.pages.flatMap((page) =>
              page.bookings.map((booking) => <BookingCard key={booking.id} booking={booking} />),
            )}
          </ul>
          {bookings.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              className="self-center"
              disabled={bookings.isFetchingNextPage}
              onClick={() => bookings.fetchNextPage()}
            >
              {t("more")}
            </Button>
          )}
        </>
      )}
    </>
  );
}
