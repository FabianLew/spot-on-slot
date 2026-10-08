"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ActionTile,
  Button,
  cn,
  PageHeader,
  Panel,
  PixelBlob,
  PixelHeadphones,
  PixelNote,
  PixelSquare,
  SectionTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatTile,
  Tag,
} from "@spot-on-slot/ui";
import { useAmountText, useExpiresText, otherSide } from "@/components/bookings/booking-text";
import type { Booking } from "@/components/bookings/queries";
import { nextFree, NEXT_FREE_DAYS } from "@/components/calendar/next-free-slots";
import { useCalendar } from "@/components/calendar/queries";
import { local, ZONE } from "@/components/calendar/warsaw-time";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useTermText } from "@/components/listings/listing-time";
import { announcing, useArtistListings, useVenueListings, type Listing } from "@/components/listings/queries";
import { messagesHref } from "@/components/messages/messages-screen";
import { useConversations, useUnreadConversations, type Conversation } from "@/components/messages/queries";
import { ProfileReminder } from "@/components/onboarding/profile-reminder";
import { useArtistProfile, useMyVenues } from "@/components/onboarding/queries";
import type { Venue } from "@/components/onboarding/profile-requests";
import { useSession } from "@/components/session/session-provider";
import { SECTION_SIZE, tonight, useArtistsNearby, useDashboardBookings } from "./queries";

const iconClass = "h-6 w-auto text-primary";
const FIND_LISTINGS = "/search?tab=listings&kind=VENUE_SEEKING";
const FIND_ARTISTS = "/search?tab=artists";
const DAY_MS = 86_400_000;

const venueQuery = (venueId: string | undefined, extra = "") =>
  venueId ? `?venue=${encodeURIComponent(venueId)}${extra ? `&${extra}` : ""}` : extra ? `?${extra}` : "";

/** A query's state as the sections need it. */
type Loadable = { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };

/** `/dashboard`: what needs the account's attention now, by role. */
export function DashboardScreen({ venueId }: { venueId?: string }) {
  const t = useTranslations();
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("nav.dashboard")} />
      <ProfileReminder />
      {role === "ARTIST" ? (
        <ArtistDashboard />
      ) : role === "VENUE" ? (
        <VenueDashboard venueId={venueId} />
      ) : (
        <Panel>
          <p className="text-sm">{t("dashboard.otherRole")}</p>
        </Panel>
      )}
    </section>
  );
}

function ArtistDashboard() {
  const t = useTranslations("dashboard");
  const tGenres = useTranslations("genres");
  const profile = useArtistProfile();
  const hasProfile = profile.data != null;
  const awaiting = useDashboardBookings("awaiting");
  const upcoming = useDashboardBookings("upcoming");
  const unread = useUnreadConversations(true);
  const conversations = useConversations();

  return (
    <>
      {profile.data && (
        <Header
          name={profile.data.stageName}
          lines={[profile.data.location?.city]}
          tags={profile.data.genres.map((genre) => tGenres(genre))}
          published={profile.data.published}
        />
      )}
      <Tiles>
        <CountTile icon={<PixelSquare className={iconClass} />} label={t("tiles.awaiting")} value={awaiting.data?.total} />
        <CountTile icon={<PixelBlob className={iconClass} />} label={t("tiles.unread")} value={unread.data} />
        <NextGigTile upcoming={upcoming} />
      </Tiles>
      <Tonight upcoming={upcoming.data?.bookings} />
      <Columns
        left={
          <>
            <BookingSection kind="awaiting" query={awaiting} />
            <BookingSection kind="upcoming" query={upcoming} emptyText={t("upcoming.emptyArtist")}
              action={{ href: FIND_LISTINGS, label: t("upcoming.actionArtist") }} />
          </>
        }
        right={
          <>
            <MessagesSection conversations={conversations} />
            {profile.isPending ? (
              <Loading />
            ) : hasProfile ? (
              <FreeTimeSection />
            ) : (
              <Section title={t("free.title")}>
                <Empty text={t("noProfile.artist")} action={{ href: "/onboarding", label: t("noProfile.action") }} />
              </Section>
            )}
            <QuickActions
              actions={[
                { href: "/calendar", label: t("actions.addFree"), icon: <PixelNote className={iconClass} /> },
                { href: "/listings?add=1", label: t("actions.announce"), icon: <PixelSquare className={iconClass} /> },
                { href: FIND_LISTINGS, label: t("actions.findListings"), icon: <PixelBlob className={iconClass} /> },
                { href: "/profile", label: t("actions.profile"), icon: <PixelHeadphones className={iconClass} /> },
              ]}
            />
          </>
        }
      />
    </>
  );
}

function VenueDashboard({ venueId }: { venueId?: string }) {
  const t = useTranslations("dashboard");
  const tGenres = useTranslations("genres");
  const tTypes = useTranslations("venueTypes");
  const router = useRouter();
  const venues = useMyVenues();
  const list = venues.data ?? [];
  const venue = list.find((item) => item.id === venueId) ?? list[0];
  const id = venue?.id;
  // Without the venue list there is nothing to narrow by yet; wait instead of loading every venue's data.
  const ready = !venues.isPending;
  const awaiting = useDashboardBookings("awaiting", id, ready);
  const upcoming = useDashboardBookings("upcoming", id, ready);
  const conversations = useConversations(id, ready);
  // `unread-count` covers all of the account's venues, so with several the tile counts the chosen venue's list.
  const several = list.length > 1;
  const unreadAll = useUnreadConversations(ready && !several);
  const unreadOfVenue = conversations.data?.pages[0]?.conversations.filter((item) => item.unreadCount > 0).length;
  const nearby = useArtistsNearby(venue);

  if (!ready) return <Loading />;
  if (venues.isError) return <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />;

  return (
    <>
      {several && (
        <div className="flex min-w-56 flex-col gap-2 self-start">
          <label htmlFor="dashboard-venue" className="text-sm font-bold uppercase">
            {t("venueSwitch")}
          </label>
          <Select
            value={id}
            onValueChange={(next) => router.replace(`/dashboard${venueQuery(next)}`, { scroll: false })}
          >
            <SelectTrigger id="dashboard-venue" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {list.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {venue && (
        <Header
          name={venue.name}
          lines={[venue.address?.city, tTypes(venue.type)]}
          tags={venue.genres.map((genre) => tGenres(genre))}
          published={venue.published}
        />
      )}
      <Tiles>
        <CountTile icon={<PixelSquare className={iconClass} />} label={t("tiles.awaiting")} value={awaiting.data?.total} />
        <CountTile
          icon={<PixelBlob className={iconClass} />}
          label={t("tiles.unread")}
          value={several ? unreadOfVenue : unreadAll.data}
        />
        <NearbyTile venue={venue} count={nearby.data} />
      </Tiles>
      <Tonight upcoming={upcoming.data?.bookings} />
      <Columns
        left={
          <>
            <BookingSection kind="awaiting" query={awaiting} venueId={id} />
            <BookingSection kind="upcoming" query={upcoming} venueId={id} emptyText={t("upcoming.emptyVenue")}
              action={{ href: FIND_ARTISTS, label: t("upcoming.actionVenue") }} />
          </>
        }
        right={
          <>
            <MessagesSection conversations={conversations} venueId={id} />
            {venue ? (
              <VenueListingsSection venueId={venue.id} />
            ) : (
              <Section title={t("listings.title")}>
                <Empty text={t("noProfile.venue")} action={{ href: "/onboarding", label: t("noProfile.action") }} />
              </Section>
            )}
            <QuickActions
              actions={[
                { href: `/listings${venueQuery(id, "add=1")}`, label: t("actions.addListing"), icon: <PixelNote className={iconClass} /> },
                { href: FIND_ARTISTS, label: t("actions.findArtists"), icon: <PixelBlob className={iconClass} /> },
                { href: messagesHref(id), label: t("actions.inbox"), icon: <PixelSquare className={iconClass} /> },
                { href: `/profile${venueQuery(id)}`, label: t("actions.profile"), icon: <PixelHeadphones className={iconClass} /> },
              ]}
            />
          </>
        }
      />
    </>
  );
}

function Header({
  name,
  lines,
  tags,
  published,
}: {
  name: string;
  lines: (string | undefined)[];
  tags: string[];
  published: boolean;
}) {
  const t = useTranslations("dashboard");
  const shown = lines.filter((line): line is string => !!line);
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-3xl leading-none break-words">{name}</h2>
        <Tag
          className={cn(
            "text-[0.625rem]",
            published ? "border-highlight bg-highlight text-highlight-foreground" : "bg-transparent text-muted-foreground",
          )}
        >
          {published ? t("published") : t("draft")}
        </Tag>
      </div>
      {shown.length > 0 && <p className="text-xs uppercase">{shown.join(" / ")}</p>}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <Tag>{tag}</Tag>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Tiles({ children }: { children: ReactNode }) {
  const t = useTranslations("dashboard");
  return (
    <section aria-label={t("today")} className="flex flex-col gap-3">
      <SectionTitle>{t("today")}</SectionTitle>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">{children}</div>
    </section>
  );
}

const tileClass = "min-w-0 p-2 sm:p-3";

function CountTile({ icon, label, value }: { icon: ReactNode; label: string; value: number | undefined }) {
  return (
    <StatTile
      className={tileClass}
      icon={icon}
      label={label}
      value={value == null ? <span aria-busy="true">…</span> : String(value).padStart(2, "0")}
    />
  );
}

function NextGigTile({ upcoming }: { upcoming: ReturnType<typeof useDashboardBookings> }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const next = upcoming.data?.bookings[0];
  const value = upcoming.data
    ? next
      ? format.dateTime(new Date(next.startsAt), { day: "2-digit", month: "short", timeZone: ZONE })
      : t("tiles.none")
    : "…";
  return <StatTile className={tileClass} icon={<PixelNote className={iconClass} />} label={t("tiles.nextGig")} value={value} />;
}

function NearbyTile({ venue, count }: { venue: Venue | undefined; count: number | undefined }) {
  const t = useTranslations("dashboard");
  const located = venue?.address?.latitude != null && venue.address.longitude != null;
  const value = !located ? t("tiles.none") : count == null ? "…" : String(count).padStart(2, "0");
  const tile = (
    <StatTile className={tileClass} icon={<PixelHeadphones className={iconClass} />} label={t("tiles.nearby")} value={value} />
  );
  if (!located) return tile;
  return (
    <Link href={FIND_ARTISTS} className="flex flex-col hover:[&>*]:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>*]:flex-1">
      {tile}
    </Link>
  );
}

function Tonight({ upcoming }: { upcoming: Booking[] | undefined }) {
  const t = useTranslations("dashboard.tonight");
  const gigs = tonight(upcoming ?? []);
  if (gigs.length === 0) return null;
  return (
    <Panel aria-label={t("title")} title={t("title")} className="border-primary">
      <ul className="flex flex-col gap-3">
        {gigs.map((booking) => (
          <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-3 text-xs font-bold uppercase">
              <PixelBlob className="h-6 w-auto shrink-0 text-primary" />
              {t("item", {
                name: otherSide(booking).name,
                time: `${local(booking.startsAt).time}–${local(booking.endsAt).time}`,
              })}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/bookings/${booking.id}`}>{t("open")}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <div className="flex min-w-0 flex-col gap-4">{left}</div>
      <div className="flex min-w-0 flex-col gap-4">{right}</div>
    </div>
  );
}

/** A titled dashboard section with an optional "Wszystkie" link to the full tab. */
function Section({ title, allHref, children }: { title: string; allHref?: string; children: ReactNode }) {
  const t = useTranslations("dashboard");
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>{title}</SectionTitle>
        {allHref && (
          <Link
            href={allHref}
            aria-label={t("allOf", { section: title })}
            className="text-xs font-bold uppercase text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("all")}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const Loading = () => <Panel aria-busy="true" className="h-24" />;

/** Loading, error or the content of a section. */
function Body({ query, children }: { query: Loadable; children: () => ReactNode }) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children()}</>;
}

function Empty({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <Panel className="gap-3">
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && (
        <Button asChild variant="outline" className="self-start">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </Panel>
  );
}

const rowClass =
  "flex flex-col gap-1 border-2 border-border bg-card px-3 py-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function BookingSection({
  kind,
  query,
  venueId,
  emptyText,
  action,
}: {
  kind: "awaiting" | "upcoming";
  query: ReturnType<typeof useDashboardBookings>;
  venueId?: string;
  emptyText?: string;
  action?: { href: string; label: string };
}) {
  const t = useTranslations("dashboard");
  const term = useTermText();
  const amount = useAmountText();
  const expires = useExpiresText();
  const allHref = `/bookings?scope=${kind}${venueId ? `&venue=${encodeURIComponent(venueId)}` : ""}`;

  return (
    <Section title={t(`${kind}.title`)} allHref={allHref}>
      <Body query={query}>
        {() =>
          query.data!.bookings.length === 0 ? (
            <Empty text={emptyText ?? t("awaiting.empty")} action={action} />
          ) : (
            <ul className="flex flex-col gap-2">
              {query.data!.bookings.map((booking) => (
                <li key={booking.id}>
                  <Link href={`/bookings/${booking.id}`} className={cn(rowClass, kind === "awaiting" && "border-primary")}>
                    <span className="font-bold uppercase break-words">{otherSide(booking).name}</span>
                    <span className="text-xs font-bold uppercase tabular-nums">{term(booking.startsAt, booking.endsAt)}</span>
                    <span className="flex flex-wrap gap-x-3 text-xs">
                      <span>{amount(booking.amount)}</span>
                      {kind === "awaiting" && booking.respondBy != null && (
                        <span className="text-muted-foreground">{t("awaiting.respondBy", { when: expires(booking.respondBy) })}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Body>
    </Section>
  );
}

function MessagesSection({
  conversations,
  venueId,
}: {
  conversations: ReturnType<typeof useConversations>;
  venueId?: string;
}) {
  const t = useTranslations("dashboard.messages");
  const tCommon = useTranslations("common");
  return (
    <Section title={t("title")} allHref={messagesHref(venueId)}>
      <Body query={conversations}>
        {() => {
          const unread = conversations
            .data!.pages.flatMap((page) => page.conversations)
            .filter((item) => item.unreadCount > 0)
            .slice(0, SECTION_SIZE);
          if (unread.length === 0) return <Empty text={t("empty")} />;
          return (
            <ul className="flex flex-col gap-2">
              {unread.map((conversation: Conversation) => (
                <li key={conversation.id}>
                  <Link href={messagesHref(venueId, conversation.id)} className={rowClass}>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-bold uppercase">{conversation.other.name}</span>
                      <span className="shrink-0 bg-primary px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-primary-foreground">
                        {conversation.unreadCount}
                        <span className="sr-only"> {t("unread", { count: conversation.unreadCount })}</span>
                      </span>
                    </span>
                    {conversation.lastMessage && (
                      <span className="truncate text-xs">
                        {conversation.lastMessage.deleted ? tCommon("messageDeleted") : conversation.lastMessage.body}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </Body>
    </Section>
  );
}

function FreeTimeSection() {
  const t = useTranslations("dashboard.free");
  const format = useFormatter();
  const [now] = useState(() => new Date());
  const [until] = useState(() => new Date(now.getTime() + NEXT_FREE_DAYS * DAY_MS));
  const calendar = useCalendar(now, until);
  const listings = useArtistListings("active");

  return (
    <Section title={t("title")} allHref="/calendar">
      <Body query={calendar}>
        {() => {
          const coming = nextFree(calendar.data!, now, SECTION_SIZE);
          if (coming.length === 0) return <Empty text={t("empty")} action={{ href: "/calendar", label: t("action") }} />;
          return (
            <ul className="flex flex-col gap-2">
              {coming.map((slot) => {
                const start = local(slot.startsAt);
                return (
                  <li key={slot.startsAt}>
                    <Link
                      href={`/calendar?day=${start.day}`}
                      className={cn(rowClass, "grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3")}
                    >
                      <span className="font-display text-sm">
                        {format.dateTime(new Date(slot.startsAt), { day: "2-digit", month: "short", timeZone: ZONE })}
                      </span>
                      <span className="text-[0.6875rem] uppercase tabular-nums">{`${start.time}–${local(slot.endsAt).time}`}</span>
                      {announcing(listings.data, slot) ? (
                        <Tag className="text-[0.625rem]">{t("announced")}</Tag>
                      ) : (
                        <span aria-hidden="true" className="font-display text-primary">
                          ›
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </Body>
    </Section>
  );
}

function VenueListingsSection({ venueId }: { venueId: string }) {
  const t = useTranslations("dashboard.listings");
  const tGenres = useTranslations("genres");
  const term = useTermText();
  const listings = useVenueListings(venueId, "active");
  const href = `/listings${venueQuery(venueId)}`;

  return (
    <Section title={t("title")} allHref={href}>
      <Body query={listings}>
        {() => {
          const soonest = [...listings.data!]
            .sort((a: Listing, b: Listing) => a.startsAt.localeCompare(b.startsAt))
            .slice(0, SECTION_SIZE);
          if (soonest.length === 0) {
            return <Empty text={t("empty")} action={{ href: `/listings${venueQuery(venueId, "add=1")}`, label: t("action") }} />;
          }
          return (
            <ul className="flex flex-col gap-2">
              {soonest.map((listing) => (
                <li key={listing.id}>
                  <Link href={href} className={rowClass}>
                    <span className="text-xs font-bold uppercase tabular-nums">{term(listing.startsAt, listing.endsAt)}</span>
                    <span className="text-xs text-muted-foreground">
                      {listing.genres.map((genre) => tGenres(genre)).join(", ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </Body>
    </Section>
  );
}

function QuickActions({ actions }: { actions: { href: string; label: string; icon: ReactNode }[] }) {
  const t = useTranslations("dashboard.actions");
  return (
    <Section title={t("title")}>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <ActionTile key={action.href + action.label} asChild icon={action.icon}>
            <Link href={action.href}>{action.label}</Link>
          </ActionTile>
        ))}
      </div>
    </Section>
  );
}
