import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Toaster } from "@spot-on-slot/ui";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import type { Occurrence } from "@/components/calendar/queries";
import { ListingView } from "./listing-view";
import { ListingsScreen } from "./listings-screen";
import type { Listing } from "./queries";

let role = "ARTIST";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "u1", email: "dj@x.pl", role, locale: "pl" } },
  }),
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

// Wednesday 14 October 2026, noon in Warsaw (UTC+2 until 25 October).
const NOW = new Date("2026-10-14T10:00:00Z");

const listing = (overrides: Partial<Listing> = {}): Listing => ({
  id: "0190a5d2-0000-7000-8000-000000000001",
  kind: "ARTIST_AVAILABLE",
  status: "ACTIVE",
  startsAt: "2026-10-16T20:00:00Z",
  endsAt: "2026-10-17T02:00:00Z",
  genres: ["TECHNO"],
  description: "Set 3 godziny",
  priceFrom: 80000,
  priceTo: 150000,
  city: "Kraków",
  travelRadiusKm: 80,
  artist: { slug: "dj-ola", stageName: "DJ Ola" },
  createdAt: "2026-10-10T10:00:00Z",
  ...overrides,
});

const free = (startsAt: string, endsAt: string, slotId: string): Occurrence => ({
  startsAt,
  endsAt,
  status: "FREE",
  source: "SLOT",
  slotId,
});

let profile: object | null;
let venues: object[];
let listings: Listing[];
let calendar: Occurrence[];
let reply: ((method: string, path: string, body: unknown) => Response | undefined) | undefined;
const requests: { method: string; path: string; search: URLSearchParams; body?: unknown }[] = [];

const problem = (status: number, code: string, detail: string) =>
  Response.json({ type: "about:blank", title: "x", detail, status, code, requestId: "r" }, { status });

const page = (content: Listing[]) => Response.json({ content, page: 0, size: 100, totalElements: content.length });

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const text = request.method !== "GET" ? await request.text() : "";
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path, search: url.searchParams, body });
  const custom = reply?.(request.method, path, body);
  if (custom) return custom;
  const route = `${request.method} ${path}`;
  const status = url.searchParams.get("status");
  const filtered = () => listings.filter((l) => !status || l.status === status);
  if (route === "GET /api/v1/artists/me")
    return profile ? Response.json(profile) : problem(404, "ARTIST_PROFILE_NOT_FOUND", "x");
  if (route === "GET /api/v1/venues/mine") return Response.json(venues);
  if (route === "GET /api/v1/listings/mine") return page(filtered());
  if (/^GET \/api\/v1\/venues\/[\w-]+\/listings$/.test(route)) return page(filtered());
  if (route === "GET /api/v1/availability/me/rules") return Response.json([]);
  if (route === "GET /api/v1/availability/me") return Response.json(calendar);
  if (request.method === "POST" && (path === "/api/v1/listings/mine" || /\/venues\/[\w-]+\/listings$/.test(path))) {
    return Response.json(listing({ id: "new", ...(body as object) }), { status: 201 });
  }
  const close = /\/listings\/([\w-]+)\/close$/.exec(path)?.[1];
  if (close) {
    listings = listings.map((l) => (l.id === close ? { ...l, status: "CLOSED" as const } : l));
    return Response.json(listings.find((l) => l.id === close));
  }
  const edited = /\/listings\/([\w-]+)$/.exec(path)?.[1];
  if (request.method === "PUT" && edited) return Response.json(listing({ id: edited, ...(body as object) }));
  return new Response(null, { status: 404 });
});

const artistProfile = {
  id: "p1",
  published: true,
  slug: "dj-ola",
  genres: ["TECHNO", "HOUSE"],
  rate: { from: 80000, to: 150000, currency: "PLN" },
  travelRadiusKm: 80,
  missingForPublication: [],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  role = "ARTIST";
  profile = artistProfile;
  venues = [];
  listings = [listing()];
  calendar = [
    free("2026-10-16T20:00:00Z", "2026-10-17T02:00:00Z", "s1"),
    free("2026-10-23T20:00:00Z", "2026-10-24T02:00:00Z", "s2"),
  ];
  reply = undefined;
  requests.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderUi(node: ReactNode) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw" now={NOW}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {node}
        <Toaster />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const sent = (method: string, pattern: RegExp) => requests.filter((r) => r.method === method && pattern.test(r.path));

describe("ListingsScreen, artist", () => {
  it("lists active listings and switches to ended ones", async () => {
    listings = [listing(), listing({ id: "old", status: "EXPIRED", startsAt: "2026-10-09T20:00:00Z" })];
    const user = userEvent.setup();
    renderUi(<ListingsScreen />);
    const active = await screen.findByRole("list", { name: "Aktywne" });
    const card = within(active).getByText("pt., 16 października · 22:00–04:00 +1").closest("li")!;
    expect(within(card).getByText("Techno")).toBeInTheDocument();
    expect(within(card).getByText("800–1500 zł")).toBeInTheDocument();
    expect(within(card).getByText("Kraków, dojazd do 80 km")).toBeInTheDocument();
    expect(within(active).queryByText("Wygasłe")).not.toBeInTheDocument();
    expect(sent("GET", /\/listings\/mine$/)[0]!.search.get("status")).toBe("ACTIVE");

    await user.click(screen.getByRole("button", { name: "Zakończone" }));
    const ended = await screen.findByRole("list", { name: "Zakończone" });
    expect(within(ended).getByText("Wygasłe")).toBeInTheDocument();
    expect(within(ended).getByRole("button", { name: /Dodaj ogłoszenie podobne/ })).toBeInTheDocument();
    expect(within(ended).queryByRole("link", { name: "Zobacz booking" })).not.toBeInTheDocument();
  });

  it("links a filled listing to the booking that filled it", async () => {
    listings = [listing({ id: "full", status: "FILLED", bookingId: "b1" })];
    const user = userEvent.setup();
    renderUi(<ListingsScreen />);
    await user.click(await screen.findByRole("button", { name: "Zakończone" }));
    const ended = await screen.findByRole("list", { name: "Zakończone" });
    expect(within(ended).getByText("Obsadzone")).toBeInTheDocument();
    expect(within(ended).getByRole("link", { name: "Zobacz booking" })).toHaveAttribute("href", "/bookings/b1");
  });

  it("announces free time picked from the calendar, with defaults from the profile", async () => {
    const user = userEvent.setup();
    renderUi(<ListingsScreen />);
    await user.click(await screen.findByRole("button", { name: "Dodaj „Jestem wolny”" }));
    const dialog = await screen.findByRole("dialog");
    const terms = await within(dialog).findByRole("list", { name: "Wolne terminy" });
    // 16 October already has an active listing.
    expect(within(terms).getByRole("button", { name: /16 października.*Już ogłoszony/ })).toBeDisabled();
    await user.click(within(terms).getByRole("button", { name: "pt., 23 października · 22:00–04:00 +1" }));

    expect(within(dialog).getByRole("button", { name: "House" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByLabelText("Stawka od (zł)")).toHaveValue("800");
    await user.type(within(dialog).getByLabelText("Opis"), "Mam własny sprzęt");
    await user.click(within(dialog).getByRole("button", { name: "Opublikuj" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent("POST", /\/listings\/mine$/)[0]!.body).toEqual({
      startsAt: "2026-10-23T20:00:00Z",
      endsAt: "2026-10-24T02:00:00Z",
      genres: ["TECHNO", "HOUSE"],
      description: "Mam własny sprzęt",
      priceFrom: 80000,
      priceTo: 150000,
      travelRadiusKm: 80,
    });
  });

  it("shows a backend refusal in the dialog", async () => {
    reply = (method, path) =>
      method === "POST" && path.endsWith("/listings/mine")
        ? problem(409, "LISTING_NOT_FREE", "Ogłoszenie musi pokrywać się z wolnym terminem w Twoim kalendarzu.")
        : undefined;
    const user = userEvent.setup();
    renderUi(<ListingsScreen />);
    await user.click(await screen.findByRole("button", { name: "Dodaj „Jestem wolny”" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: /23 października/ }));
    await user.click(within(dialog).getByRole("button", { name: "Opublikuj" }));
    expect(await within(dialog).findByText(/musi pokrywać się z wolnym terminem/)).toBeInTheDocument();
  });

  it("points to the calendar when there is no free time", async () => {
    calendar = [];
    const user = userEvent.setup();
    renderUi(<ListingsScreen />);
    await user.click(await screen.findByRole("button", { name: "Dodaj „Jestem wolny”" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("link", { name: "Otwórz kalendarz" })).toHaveAttribute("href", "/calendar");
  });

  it("edits and closes an active listing", async () => {
    const user = userEvent.setup();
    renderUi(<ListingsScreen />);
    await user.click(await screen.findByRole("button", { name: /^Edytuj ogłoszenie/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("pt., 16 października · 22:00–04:00 +1")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Stawka do (zł)"));
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(sent("PUT", /\/listings\/[\w-]+$/)).toHaveLength(1));
    expect(sent("PUT", /\/listings\/[\w-]+$/)[0]!.body).toMatchObject({
      startsAt: "2026-10-16T20:00:00Z",
      priceFrom: 80000,
    });
    expect(sent("PUT", /\/listings\/[\w-]+$/)[0]!.body as object).not.toHaveProperty("priceTo");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^Zamknij ogłoszenie/ }));
    await waitFor(() => expect(sent("POST", /\/close$/)).toHaveLength(1));
    expect(await screen.findByText(pl.listings.empty.active)).toBeInTheDocument();
  });

  it("asks for a published profile first", async () => {
    profile = { ...artistProfile, published: false, missingForPublication: ["AVATAR"] };
    renderUi(<ListingsScreen />);
    expect(await screen.findByText(pl.listings.artistNotPublished)).toBeInTheDocument();
    expect(screen.getByText(/zdjęcia głównego/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dodaj „Jestem wolny”" })).not.toBeInTheDocument();
  });
});

describe("ListingsScreen, venue", () => {
  beforeEach(() => {
    role = "VENUE";
    venues = [
      { id: "v1", name: "Pod Ziemią", published: true, genres: ["HOUSE"], role: "MANAGER", missingForPublication: [] },
      { id: "v2", name: "Szkic", published: false, genres: [], role: "OWNER", missingForPublication: ["ADDRESS"] },
    ];
    listings = [
      listing({
        kind: "VENUE_SEEKING",
        artist: undefined,
        venue: { slug: "pod-ziemia", name: "Pod Ziemią" },
        travelRadiusKm: undefined,
        priceFrom: undefined,
        priceTo: undefined,
      }),
    ];
  });

  it("posts a listing across midnight for the chosen venue", async () => {
    const user = userEvent.setup();
    renderUi(<ListingsScreen add />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Szukam artysty" })).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Data"));
    await user.type(within(dialog).getByLabelText("Data"), "2026-10-30");
    expect(within(dialog).getByText(pl.listings.dialog.nextDay)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Budżet od (zł)"), "1000");
    await user.click(within(dialog).getByRole("button", { name: "Opublikuj" }));

    await waitFor(() => expect(sent("POST", /\/venues\/v1\/listings$/)).toHaveLength(1));
    // 30 October is after the clock change: Warsaw is UTC+1.
    expect(sent("POST", /\/venues\/v1\/listings$/)[0]!.body).toEqual({
      startsAt: "2026-10-30T20:00:00.000Z",
      endsAt: "2026-10-31T02:00:00.000Z",
      genres: ["HOUSE"],
      priceFrom: 100000,
    });
    expect(await screen.findByText("Do ustalenia")).toBeInTheDocument();
  });

  it("asks to publish a draft venue before posting", async () => {
    renderUi(<ListingsScreen venueId="v2" />);
    expect(await screen.findByText(/Lokal Szkic nie jest jeszcze opublikowany/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przejdź do profilu" })).toHaveAttribute("href", "/profile?venue=v2");
  });
});

describe("Calendar announcements", () => {
  it("announces free time from the day panel and marks announced time", async () => {
    const user = userEvent.setup();
    renderUi(<CalendarScreen />);
    await user.click(await screen.findByRole("button", { name: /^16 października 2026/ }));
    const announced = (await screen.findByText("22:00–04:00")).closest("li")!;
    expect(await within(announced).findByText("Ogłoszony")).toBeInTheDocument();
    expect(within(announced).queryByRole("button", { name: /^Ogłoś termin/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^23 października 2026/ }));
    const entry = (await screen.findByText("22:00–04:00")).closest("li")!;
    await user.click(await within(entry).findByRole("button", { name: "Ogłoś termin 22:00–04:00" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("pt., 23 października · 22:00–04:00 +1")).toBeInTheDocument();
  });
});

describe("ListingView", () => {
  it("shows the listing and links its author", () => {
    renderUi(<ListingView listing={listing()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Jestem wolny" })).toBeInTheDocument();
    expect(screen.getByText("Set 3 godziny")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz profil" })).toHaveAttribute("href", "/a/dj-ola");
  });
});
