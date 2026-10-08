import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import type { Booking } from "@/components/bookings/queries";
import type { Conversation } from "@/components/messages/queries";
import { DashboardScreen } from "./dashboard-screen";
import { tonight } from "./queries";

let role = "ARTIST";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "u1", email: "x@x.pl", role, locale: "pl" } },
  }),
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

// Wednesday 14 October 2026, noon in Warsaw (UTC+2 until 25 October).
const NOW = new Date("2026-10-14T10:00:00Z");

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "b1",
  status: "PENDING",
  awaiting: "ARTIST",
  myParty: "ARTIST",
  myTurn: true,
  canWithdraw: false,
  initiator: "VENUE",
  startsAt: "2026-10-16T20:00:00Z",
  endsAt: "2026-10-17T00:00:00Z",
  amount: 150000,
  revision: 1,
  respondBy: "2026-10-16T10:00:00Z",
  artist: { slug: "dj-ola", stageName: "DJ Ola" },
  venue: { id: "v1", slug: "klub-x", name: "Klub X" },
  steps: [],
  createdAt: "2026-10-13T10:00:00Z",
  ...overrides,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: "c1",
  kind: "DIRECT",
  venueId: "v1",
  myParty: "ARTIST",
  other: { name: "Klub X", slug: "klub-x" },
  lastMessage: {
    id: "m1",
    conversationId: "c1",
    side: "VENUE",
    mine: false,
    body: "Zagrasz w piątek?",
    createdAt: "2026-10-14T09:00:00Z",
    deleted: false,
  },
  unreadCount: 2,
  blockedByMe: false,
  blockedByOther: false,
  canWrite: true,
  lastMessageAt: "2026-10-14T09:00:00Z",
  ...overrides,
});

const venue = (overrides: object = {}) => ({
  id: "v1",
  slug: "klub-x",
  name: "Klub X",
  type: "CLUB",
  published: true,
  role: "OWNER",
  genres: ["TECHNO"],
  address: { street: "Długa 1", city: "Kraków", latitude: 50.06, longitude: 19.94 },
  missingForPublication: [],
  ...overrides,
});

let artistProfile: object | null;
let venues: object[];
let awaiting: Booking[];
let upcoming: Booking[];
let conversations: Conversation[];
let unread: number;
let occurrences: object[];
let listings: object[];
let failing: string | null;
const requests: { path: string; search: URLSearchParams }[] = [];

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  requests.push({ path, search: url.searchParams });
  if (failing && path.startsWith(failing)) {
    return Response.json({ title: "x", status: 500, code: "INTERNAL_ERROR", requestId: "r" }, { status: 500 });
  }
  const page = (content: unknown[]) => Response.json({ content, page: 0, size: 20, totalElements: content.length });
  if (path === "/api/v1/artists/me") {
    return artistProfile ? Response.json(artistProfile) : Response.json({ code: "X" }, { status: 404 });
  }
  if (path === "/api/v1/venues/mine") return Response.json(venues);
  if (path === "/api/v1/bookings") return page(url.searchParams.get("awaitingMe") === "true" ? awaiting : upcoming);
  if (path === "/api/v1/conversations/unread-count") return Response.json({ conversations: unread, messages: unread });
  if (path === "/api/v1/conversations") return page(conversations);
  if (path === "/api/v1/availability/me") return Response.json(occurrences);
  if (path === "/api/v1/listings/mine" || /^\/api\/v1\/venues\/\w+\/listings$/.test(path)) return page(listings);
  if (path === "/api/v1/search/artists") return Response.json({ content: [], page: 0, size: 1, totalElements: 24 });
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  role = "ARTIST";
  artistProfile = {
    id: "p1",
    stageName: "DJ Ola",
    genres: ["TECHNO"],
    location: { label: "Kraków", city: "Kraków" },
    published: true,
    missingForPublication: [],
  };
  venues = [venue()];
  awaiting = [booking()];
  upcoming = [
    booking({ id: "b2", status: "ACCEPTED", myTurn: false, respondBy: undefined, startsAt: "2026-10-23T20:00:00Z", endsAt: "2026-10-24T01:00:00Z" }),
  ];
  conversations = [conversation(), conversation({ id: "c2", unreadCount: 0, other: { name: "Bar Y" } })];
  unread = 1;
  occurrences = [
    { id: "o1", startsAt: "2026-10-17T19:00:00Z", endsAt: "2026-10-18T01:00:00Z", status: "FREE" },
    { id: "o2", startsAt: "2026-10-24T19:00:00Z", endsAt: "2026-10-25T01:00:00Z", status: "FREE" },
  ];
  listings = [
    { id: "l1", kind: "ARTIST_AVAILABLE", status: "ACTIVE", startsAt: "2026-10-17T19:00:00Z", endsAt: "2026-10-18T01:00:00Z", genres: ["TECHNO"], createdAt: "2026-10-10T10:00:00Z" },
  ];
  failing = null;
  requests.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderUi(venueId?: string) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw" now={NOW}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DashboardScreen venueId={venueId} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });

describe("artist dashboard", () => {
  it("shows the tiles, the sections and the quick actions", async () => {
    renderUi();
    expect(await screen.findByRole("heading", { name: "DJ Ola" })).toBeInTheDocument();

    const tiles = within(screen.getByRole("region", { name: "Dziś" }));
    await waitFor(() => expect(tiles.getByText("Czeka na mnie").nextElementSibling).toHaveTextContent("01"));
    expect(tiles.getByText("Nieprzeczytane").nextElementSibling).toHaveTextContent("01");
    expect(tiles.getByText("Najbliższy występ").nextElementSibling).toHaveTextContent("23 paź");

    const waiting = within(section("Czeka na odpowiedź"));
    expect(await waiting.findByRole("link", { name: /Klub X/ })).toHaveAttribute("href", "/bookings/b1");
    expect(waiting.getByRole("link", { name: "Wszystkie: Czeka na odpowiedź" })).toHaveAttribute(
      "href",
      "/bookings?scope=awaiting",
    );

    const gigs = within(section("Nadchodzące występy"));
    expect(await gigs.findByRole("link", { name: /Klub X/ })).toHaveAttribute("href", "/bookings/b2");

    const inbox = within(section("Wiadomości"));
    expect(await inbox.findByRole("link", { name: /Klub X/ })).toHaveAttribute("href", "/messages/c1");
    expect(inbox.queryByText("Bar Y")).not.toBeInTheDocument();

    const free = within(section("Wolne terminy"));
    const first = await free.findByRole("link", { name: /17 paź/ });
    expect(first).toHaveAttribute("href", "/calendar?day=2026-10-17");
    expect(within(first).getByText("Ogłoszony")).toBeInTheDocument();
    expect(free.getByRole("link", { name: /24 paź/ })).not.toHaveTextContent("Ogłoszony");

    const actions = within(section("Szybkie akcje"));
    expect(actions.getByRole("link", { name: "Dodaj wolny termin" })).toHaveAttribute("href", "/calendar");
    expect(actions.getByRole("link", { name: "Ogłoś się" })).toHaveAttribute("href", "/listings?add=1");
    expect(actions.getByRole("link", { name: "Szukaj ogłoszeń" })).toHaveAttribute(
      "href",
      "/search?tab=listings&kind=VENUE_SEEKING",
    );
    expect(actions.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("region", { name: "Dziś wieczorem" })).not.toBeInTheDocument();
  });

  it("explains empty sections with a way forward", async () => {
    awaiting = [];
    upcoming = [];
    conversations = [];
    unread = 0;
    occurrences = [];
    renderUi();

    expect(await within(section("Czeka na odpowiedź")).findByText("Nic nie czeka na Twoją odpowiedź.")).toBeInTheDocument();
    const gigs = within(section("Nadchodzące występy"));
    expect(await gigs.findByText("Brak nadchodzących występów.")).toBeInTheDocument();
    expect(gigs.getByRole("link", { name: "Szukaj ogłoszeń" })).toHaveAttribute(
      "href",
      "/search?tab=listings&kind=VENUE_SEEKING",
    );
    expect(await within(section("Wiadomości")).findByText("Wszystko przeczytane.")).toBeInTheDocument();
    const free = within(section("Wolne terminy"));
    expect(await free.findByText("Brak wolnych terminów w najbliższych 60 dniach.")).toBeInTheDocument();
    expect(free.getByRole("link", { name: "Dodaj wolny termin" })).toHaveAttribute("href", "/calendar");
    expect(within(screen.getByRole("region", { name: "Dziś" })).getByText("Najbliższy występ").nextElementSibling).toHaveTextContent("—");
  });

  it("shows tonight's gig only on its day", async () => {
    upcoming = [booking({ id: "b3", status: "ACCEPTED", myTurn: false, startsAt: "2026-10-14T19:00:00Z", endsAt: "2026-10-15T00:00:00Z" })];
    renderUi();
    const panel = within(await screen.findByRole("region", { name: "Dziś wieczorem" }));
    expect(panel.getByText(/Klub X/)).toHaveTextContent("21:00");
    expect(panel.getByRole("link", { name: "Zobacz booking" })).toHaveAttribute("href", "/bookings/b3");
  });

  it("keeps the other sections when one fails", async () => {
    failing = "/api/v1/availability";
    renderUi();
    const free = within(await screen.findByRole("region", { name: "Wolne terminy" }));
    expect(await free.findByRole("button", { name: "Spróbuj ponownie" })).toBeInTheDocument();
    expect(await within(section("Czeka na odpowiedź")).findByRole("link", { name: /Klub X/ })).toBeInTheDocument();
  });

  it("asks for the profile before anything else when there is none", async () => {
    artistProfile = null;
    awaiting = [];
    upcoming = [];
    conversations = [];
    renderUi();
    expect(await screen.findByText("Dokończ profil")).toBeInTheDocument();
    const free = within(section("Wolne terminy"));
    expect(await free.findByRole("link", { name: "Utwórz profil" })).toHaveAttribute("href", "/onboarding");
    expect(requests.some((r) => r.path === "/api/v1/availability/me")).toBe(false);
  });
});

describe("venue dashboard", () => {
  beforeEach(() => {
    role = "VENUE";
    awaiting = [booking({ myParty: "VENUE", awaiting: "VENUE" })];
    upcoming = [];
    conversations = [conversation({ myParty: "VENUE", other: { name: "DJ Ola", slug: "dj-ola" } })];
    listings = [
      { id: "l2", kind: "VENUE_SEEKING", status: "ACTIVE", startsAt: "2026-10-30T19:00:00Z", endsAt: "2026-10-31T01:00:00Z", genres: ["HOUSE"], createdAt: "2026-10-12T10:00:00Z" },
      { id: "l1", kind: "VENUE_SEEKING", status: "ACTIVE", startsAt: "2026-10-23T19:00:00Z", endsAt: "2026-10-24T01:00:00Z", genres: ["TECHNO"], createdAt: "2026-10-10T10:00:00Z" },
    ];
  });

  it("shows the venue, the artists nearby and its listings soonest first", async () => {
    renderUi();
    expect(await screen.findByRole("heading", { name: "Klub X" })).toBeInTheDocument();
    const tiles = within(screen.getByRole("region", { name: "Dziś" }));
    await waitFor(() => expect(tiles.getByText("Artyści w pobliżu").nextElementSibling).toHaveTextContent("24"));
    const search = requests.find((r) => r.path === "/api/v1/search/artists")!.search;
    expect(search.get("lat")).toBe("50.06");
    expect(search.get("radiusKm")).toBe("50");

    expect(await within(section("Czeka na odpowiedź")).findByRole("link", { name: /DJ Ola/ })).toBeInTheDocument();
    const own = within(section("Moje ogłoszenia"));
    const items = await own.findAllByRole("link", { name: /paź/ });
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("23 paź"),
      expect.stringContaining("30 paź"),
    ]);
    expect(within(section("Nadchodzące występy")).getByRole("link", { name: "Szukaj artystów" })).toHaveAttribute(
      "href",
      "/search?tab=artists",
    );
    const actions = within(section("Szybkie akcje"));
    expect(actions.getByRole("link", { name: "Dodaj ogłoszenie" })).toHaveAttribute("href", "/listings?venue=v1&add=1");
    expect(actions.getByRole("link", { name: "Wiadomości" })).toHaveAttribute("href", "/messages?venue=v1");
    expect(actions.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profile?venue=v1");
  });

  it("switches venues through the address and narrows every query", async () => {
    venues = [venue(), venue({ id: "v2", slug: "bar-y", name: "Bar Y", address: { street: "A 1", city: "Kraków" } })];
    renderUi("v2");
    expect(await screen.findByRole("heading", { name: "Bar Y" })).toBeInTheDocument();
    await waitFor(() => expect(requests.some((r) => r.path === "/api/v1/venues/v2/listings")).toBe(true));
    const narrowed = requests.filter((r) => r.path === "/api/v1/bookings" || r.path === "/api/v1/conversations");
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.every((r) => r.search.get("venueId") === "v2")).toBe(true);
    expect(within(screen.getByRole("region", { name: "Dziś" })).getByText("Artyści w pobliżu").nextElementSibling).toHaveTextContent("—");
    expect(requests.some((r) => r.path === "/api/v1/search/artists")).toBe(false);
    // Several venues: the unread tile counts the venue's own conversations.
    await waitFor(() =>
      expect(within(screen.getByRole("region", { name: "Dziś" })).getByText("Nieprzeczytane").nextElementSibling).toHaveTextContent("01"),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Lokal" }));
    await user.click(await screen.findByRole("option", { name: "Klub X" }));
    expect(replace).toHaveBeenCalledWith("/dashboard?venue=v1", { scroll: false });
  });
});

describe("other roles", () => {
  it("greets without sections", async () => {
    role = "ADMIN";
    renderUi();
    expect(screen.getByText("Pulpit z bookingami i wiadomościami jest dla kont artystów i lokali.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Dziś" })).not.toBeInTheDocument();
  });
});

describe("tonight", () => {
  it("takes today's and already started gigs", () => {
    const today = booking({ id: "t", startsAt: "2026-10-14T19:00:00Z" });
    const started = booking({ id: "s", startsAt: "2026-10-13T20:00:00Z" });
    const later = booking({ id: "l", startsAt: "2026-10-15T19:00:00Z" });
    expect(tonight([started, today, later], NOW).map((b) => b.id)).toEqual(["s", "t"]);
  });
});
