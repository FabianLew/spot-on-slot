import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Toaster } from "@spot-on-slot/ui";
import { BookingCta } from "./booking-cta";
import { BookingDetail } from "./booking-detail";
import { BookingsScreen } from "./bookings-screen";
import { NewBookingScreen } from "./new-booking-screen";
import type { Booking } from "./queries";

let role = "VENUE";
let signedIn = true;
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: signedIn
      ? { status: "authenticated", user: { id: "u1", email: "x@x.pl", role, locale: "pl" } }
      : { status: "anonymous" },
  }),
}));
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

// Wednesday 14 October 2026, noon in Warsaw (UTC+2 until 25 October).
const NOW = new Date("2026-10-14T10:00:00Z");

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "0190a5d2-0000-7000-8000-0000000000b1",
  status: "PENDING",
  awaiting: "VENUE",
  myParty: "VENUE",
  myTurn: true,
  canWithdraw: false,
  initiator: "VENUE",
  startsAt: "2026-10-16T20:00:00Z",
  endsAt: "2026-10-17T00:00:00Z",
  amount: 150000,
  revision: 2,
  respondBy: "2026-10-16T10:00:00Z",
  message: "Za 1500 zł chętnie",
  artist: { slug: "dj-ola", stageName: "DJ Ola" },
  venue: { id: "v1", slug: "klub-x", name: "Klub X" },
  steps: [
    {
      type: "REQUESTED",
      party: "VENUE",
      mine: true,
      at: "2026-10-13T10:00:00Z",
      startsAt: "2026-10-16T20:00:00Z",
      endsAt: "2026-10-17T00:00:00Z",
      amount: 100000,
      message: "Zagrasz u nas?",
    },
    {
      type: "COUNTERED",
      party: "ARTIST",
      mine: false,
      at: "2026-10-14T08:00:00Z",
      startsAt: "2026-10-16T20:00:00Z",
      endsAt: "2026-10-17T00:00:00Z",
      amount: 150000,
      message: "Za 1500 zł chętnie",
    },
  ],
  createdAt: "2026-10-13T10:00:00Z",
  ...overrides,
});

const venue = (overrides: object = {}) => ({
  id: "v1",
  name: "Klub X",
  published: true,
  role: "OWNER",
  genres: ["TECHNO"],
  missingForPublication: [],
  ...overrides,
});

const publicArtist = { stageName: "DJ Ola", slug: "dj-ola", rate: { from: 80000, to: 150000 }, genres: ["TECHNO"] };

const listing = (overrides: object = {}) => ({
  id: "0190a5d2-0000-7000-8000-0000000000a1",
  kind: "VENUE_SEEKING",
  status: "ACTIVE",
  startsAt: "2026-10-23T19:00:00Z",
  endsAt: "2026-10-24T01:00:00Z",
  genres: ["TECHNO"],
  priceFrom: 50000,
  priceTo: 120000,
  city: "Kraków",
  venue: { slug: "klub-x", name: "Klub X" },
  createdAt: "2026-10-10T10:00:00Z",
  ...overrides,
});

let venues: object[];
let artistProfile: object | null;
let bookings: Booking[];
let awaiting: number;
let current: Booking | null;
let reply: ((method: string, path: string, body: unknown) => Response | undefined) | undefined;
const requests: { method: string; path: string; search: URLSearchParams; body?: unknown }[] = [];

const problem = (status: number, code: string, detail: string) =>
  Response.json({ type: "about:blank", title: "x", detail, status, code, requestId: "r" }, { status });

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const text = request.method !== "GET" ? await request.text() : "";
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path, search: url.searchParams, body });
  const custom = reply?.(request.method, path, body);
  if (custom) return custom;
  const route = `${request.method} ${path}`;
  if (route === "GET /api/v1/venues/mine") return Response.json(venues);
  if (route === "GET /api/v1/artists/me") {
    return artistProfile ? Response.json(artistProfile) : problem(404, "ARTIST_PROFILE_NOT_FOUND", "x");
  }
  if (route === "GET /api/v1/public/artists/dj-ola") return Response.json(publicArtist);
  if (route === "GET /api/v1/public/artists/dj-ola/availability") {
    return Response.json([
      { startsAt: "2026-10-16T19:00:00Z", endsAt: "2026-10-17T02:00:00Z", status: "BOOKED" },
      { startsAt: "2026-10-23T19:00:00Z", endsAt: "2026-10-24T02:00:00Z", status: "FREE" },
    ]);
  }
  if (route === "GET /api/v1/bookings") {
    if (url.searchParams.get("awaitingMe") === "true" && url.searchParams.get("size") === "1") {
      return Response.json({ content: [], page: 0, size: 1, totalElements: awaiting });
    }
    return Response.json({ content: bookings, page: 0, size: 20, totalElements: bookings.length });
  }
  if (route === "POST /api/v1/bookings") return Response.json(booking({ id: "new" }), { status: 201 });
  const one = /^\/api\/v1\/bookings\/([\w-]+)$/.exec(path)?.[1];
  if (request.method === "GET" && one) return current ? Response.json(current) : problem(404, "BOOKING_NOT_FOUND", "x");
  const step = /^\/api\/v1\/bookings\/[\w-]+\/(\w+)$/.exec(path)?.[1];
  if (request.method === "POST" && step && current) {
    const status = { accept: "ACCEPTED", decline: "DECLINED", withdraw: "WITHDRAWN", cancel: "CANCELLED" }[step];
    current = status
      ? { ...current, status: status as Booking["status"], myTurn: false, canWithdraw: false, respondBy: undefined }
      : { ...current, ...(body as object), myTurn: false, revision: current.revision + 1 };
    return Response.json(current);
  }
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  role = "VENUE";
  signedIn = true;
  venues = [venue()];
  artistProfile = { id: "p1", published: true, rate: { from: 90000 }, missingForPublication: [] };
  bookings = [booking()];
  awaiting = 1;
  current = booking();
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

describe("NewBookingScreen, venue asks an artist", () => {
  it("picks the artist's free time, narrows the hours and sends the request", async () => {
    const user = userEvent.setup();
    renderUi(<NewBookingScreen source={{ artist: "dj-ola" }} />);
    expect(await screen.findByText("Do: DJ Ola")).toBeInTheDocument();
    const terms = await screen.findByRole("list", { name: "Wolne terminy artysty" });
    // Booked time is not offered.
    expect(within(terms).getAllByRole("button")).toHaveLength(1);
    await user.click(within(terms).getByRole("button", { name: "pt., 23 października · 21:00–04:00 +1" }));

    expect(screen.getByText("Wolny termin artysty: pt., 23 października · 21:00–04:00 +1")).toBeInTheDocument();
    expect(screen.getByLabelText("Honorarium (zł)")).toHaveValue("800");
    await user.clear(screen.getByLabelText("Od"));
    await user.type(screen.getByLabelText("Od"), "20:00");
    await user.click(screen.getByRole("button", { name: "Wyślij zapytanie" }));
    expect(await screen.findByText("Godziny muszą mieścić się w wybranym wolnym terminie.")).toBeInTheDocument();
    expect(sent("POST", /\/bookings$/)).toEqual([]);

    await user.clear(screen.getByLabelText("Od"));
    await user.type(screen.getByLabelText("Od"), "22:00");
    await user.clear(screen.getByLabelText("Do"));
    await user.type(screen.getByLabelText("Do"), "02:00");
    await user.clear(screen.getByLabelText("Honorarium (zł)"));
    await user.type(screen.getByLabelText("Honorarium (zł)"), "1000");
    await user.type(screen.getByLabelText("Wiadomość"), "Zagrasz u nas?");
    await user.click(screen.getByRole("button", { name: "Wyślij zapytanie" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/new"));
    expect(sent("POST", /\/bookings$/)[0]!.body).toEqual({
      venueId: "v1",
      artistSlug: "dj-ola",
      startsAt: "2026-10-23T20:00:00.000Z",
      endsAt: "2026-10-24T00:00:00.000Z",
      amount: 100000,
      message: "Zagrasz u nas?",
    });
    expect(await screen.findByText("Zapytanie wysłane.")).toBeInTheDocument();
  });

  it("answers an artist's listing within its time and shows server errors", async () => {
    const free = listing({
      kind: "ARTIST_AVAILABLE",
      venue: undefined,
      artist: { slug: "dj-ola", stageName: "DJ Ola" },
      priceFrom: 70000,
      priceTo: undefined,
    });
    reply = (method, path) => {
      if (method === "GET" && path.startsWith("/api/v1/public/listings/")) return Response.json(free);
      if (method === "POST" && path === "/api/v1/bookings") {
        return problem(409, "BOOKING_NOT_FREE", "Artysta nie jest już wolny w tym czasie.");
      }
    };
    const user = userEvent.setup();
    renderUi(<NewBookingScreen source={{ listing: free.id }} />);
    expect(await screen.findByText("Termin z ogłoszenia: pt., 23 października · 21:00–03:00 +1")).toBeInTheDocument();
    expect(screen.getByLabelText("Honorarium (zł)")).toHaveValue("700");
    await user.click(screen.getByRole("button", { name: "Wyślij zapytanie" }));

    expect(await screen.findByText("Artysta nie jest już wolny w tym czasie.")).toBeInTheDocument();
    expect(sent("POST", /\/bookings$/)[0]!.body).toMatchObject({ venueId: "v1", listingId: free.id, amount: 70000 });
    expect(push).not.toHaveBeenCalled();
  });

  it("lets only a venue with a published venue ask", async () => {
    venues = [venue({ published: false })];
    renderUi(<NewBookingScreen source={{ artist: "dj-ola" }} />);
    expect(
      await screen.findByText("Zapytanie wysyła opublikowany lokal. Opublikuj swój lokal."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przejdź do profilu" })).toHaveAttribute("href", "/profile?venue=v1");
  });

  it("tells artists that venues send requests", async () => {
    role = "ARTIST";
    renderUi(<NewBookingScreen source={{ artist: "dj-ola" }} />);
    expect(await screen.findByText("Zapytania do artystów wysyłają lokale.")).toBeInTheDocument();
  });
});

describe("NewBookingScreen, artist applies", () => {
  beforeEach(() => {
    role = "ARTIST";
    reply = (method, path) =>
      method === "GET" && path.startsWith("/api/v1/public/listings/") ? Response.json(listing()) : undefined;
  });

  it("sends the fee and message for the listing's time", async () => {
    const user = userEvent.setup();
    renderUi(<NewBookingScreen source={{ listing: listing().id }} />);
    expect(await screen.findByText("Do: Klub X")).toBeInTheDocument();
    expect(screen.getByText("pt., 23 października · 21:00–03:00 +1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Od")).not.toBeInTheDocument();
    // The budget's top is the starting fee.
    expect(screen.getByLabelText("Honorarium (zł)")).toHaveValue("1200");
    await user.type(screen.getByLabelText("Wiadomość"), "Chętnie zagram");
    await user.click(screen.getByRole("button", { name: "Wyślij zgłoszenie" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/new"));
    expect(sent("POST", /\/bookings$/)[0]!.body).toEqual({
      listingId: listing().id,
      amount: 120000,
      message: "Chętnie zagram",
    });
  });

  it("needs a published profile", async () => {
    artistProfile = { id: "p1", published: false, missingForPublication: ["AVATAR"] };
    renderUi(<NewBookingScreen source={{ listing: listing().id }} />);
    expect(await screen.findByText("Zgłoszenie wymaga opublikowanego profilu artysty.")).toBeInTheDocument();
  });

  it("explains a listing that is gone", async () => {
    reply = (method, path) =>
      method === "GET" && path.startsWith("/api/v1/public/listings/")
        ? problem(404, "LISTING_NOT_FOUND", "x")
        : undefined;
    renderUi(<NewBookingScreen source={{ listing: listing().id }} />);
    expect(
      await screen.findByText("Nie ma takiego artysty albo ogłoszenie nie jest już aktywne."),
    ).toBeInTheDocument();
  });
});

describe("BookingsScreen", () => {
  it("starts on what waits for me and switches filters through the address", async () => {
    const user = userEvent.setup();
    renderUi(<BookingsScreen />);
    const list = await screen.findByRole("list", { name: "Czeka na mnie" });
    const card = within(list).getByRole("link", {
      name: "Szczegóły bookingu: DJ Ola, pt., 16 października · 22:00–02:00 +1",
    });
    expect(card).toHaveAttribute("href", `/bookings/${booking().id}`);
    expect(within(card).getByText("Czeka na Ciebie")).toBeInTheDocument();
    expect(within(card).getByText("1500 zł")).toBeInTheDocument();
    expect(within(card).getByText("Wygasa za 2 dni")).toBeInTheDocument();
    expect(sent("GET", /\/bookings$/).at(-1)!.search.get("awaitingMe")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Historia" }));
    expect(replace).toHaveBeenCalledWith("/bookings?scope=history", { scroll: false });
  });

  it("asks the history for every closed status, newest first", async () => {
    bookings = [booking({ status: "CANCELLED", myTurn: false, respondBy: undefined })];
    renderUi(<BookingsScreen scope="history" />);
    const list = await screen.findByRole("list", { name: "Historia" });
    expect(within(list).getByText("Anulowany")).toBeInTheDocument();
    const search = sent("GET", /\/bookings$/).at(-1)!.search;
    expect(search.getAll("status")).toEqual(["COMPLETED", "CANCELLED", "DECLINED", "WITHDRAWN", "EXPIRED"]);
    expect(search.get("sort")).toBe("startsAt,desc");
  });

  it("starts on pending bookings when nothing waits, and narrows to one venue", async () => {
    awaiting = 0;
    bookings = [];
    venues = [venue(), venue({ id: "v2", name: "Klub Y" })];
    renderUi(<BookingsScreen venueId="v2" />);
    expect(await screen.findByText("Nie masz bookingów w negocjacji.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otwórz wyszukiwarkę" })).toHaveAttribute("href", "/search?tab=artists");
    await waitFor(() => expect(sent("GET", /\/bookings$/).at(-1)!.search.get("venueId")).toBe("v2"));
    expect(sent("GET", /\/bookings$/).at(-1)!.search.getAll("status")).toEqual(["PENDING"]);
  });
});

describe("BookingDetail", () => {
  it("shows the terms and the history, newest first, and accepts the current offer", async () => {
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    expect(await screen.findByRole("heading", { name: "DJ Ola", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Twoja kolej. Bez odpowiedzi booking wygaśnie za 2 dni.")).toBeInTheDocument();
    const steps = document.querySelectorAll("[data-step]");
    expect([...steps].map((step) => step.getAttribute("data-step"))).toEqual(["COUNTERED", "REQUESTED"]);
    expect(within(steps[1] as HTMLElement).getByText(/^Ty/)).toBeInTheDocument();
    expect(within(steps[1] as HTMLElement).getByText("pt., 16 października · 22:00–02:00 +1 · 1000 zł")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Akceptuj" }));
    expect(await screen.findByText(/Booking zaakceptowany/)).toBeInTheDocument();
    expect(sent("POST", /\/accept$/)[0]!.body).toEqual({ revision: 2 });
    expect(await screen.findByRole("button", { name: "Anuluj booking" })).toBeInTheDocument();
  });

  it("refreshes a stale offer instead of accepting it", async () => {
    let fresh = false;
    reply = (method, path) => {
      if (method === "POST" && path.endsWith("/accept")) {
        fresh = true;
        current = booking({ revision: 3, amount: 180000 });
        return problem(409, "BOOKING_STALE", "x");
      }
    };
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    await user.click(await screen.findByRole("button", { name: "Akceptuj" }));
    expect(
      await screen.findByText("Pojawiła się nowa propozycja. Sprawdź warunki i zdecyduj jeszcze raz."),
    ).toBeInTheDocument();
    expect(fresh).toBe(true);
    expect(await screen.findByText("1800 zł")).toBeInTheDocument();
  });

  it("sends an artist with a calendar conflict to that day in the calendar", async () => {
    role = "ARTIST";
    current = booking({ myParty: "ARTIST", awaiting: "ARTIST" });
    reply = (method, path) =>
      method === "POST" && path.endsWith("/accept") ? problem(409, "BOOKING_CALENDAR_CONFLICT", "x") : undefined;
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    expect(await screen.findByRole("heading", { name: "Klub X", level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Akceptuj" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/koliduje z Twoim kalendarzem/)).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Otwórz kalendarz" })).toHaveAttribute(
      "href",
      "/calendar?day=2026-10-16",
    );
  });

  it("counters with new terms across midnight", async () => {
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    await user.click(await screen.findByRole("button", { name: "Kontroferta" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Honorarium (zł)")).toHaveValue("1500");
    await user.clear(within(dialog).getByLabelText("Od"));
    await user.type(within(dialog).getByLabelText("Od"), "23:00");
    await user.clear(within(dialog).getByLabelText("Do"));
    await user.type(within(dialog).getByLabelText("Do"), "03:00");
    expect(within(dialog).getByText("Kończy się następnego dnia.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Honorarium (zł)"));
    await user.type(within(dialog).getByLabelText("Honorarium (zł)"), "1200");
    await user.click(within(dialog).getByRole("button", { name: "Wyślij kontrofertę" }));

    expect(await screen.findByText("Kontroferta wysłana.")).toBeInTheDocument();
    expect(sent("POST", /\/counter$/)[0]!.body).toEqual({
      startsAt: "2026-10-16T21:00:00.000Z",
      endsAt: "2026-10-17T01:00:00.000Z",
      amount: 120000,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("declines with an optional reason", async () => {
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    await user.click(await screen.findByRole("button", { name: "Odrzuć" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Powód"), "Mamy już kogoś");
    await user.click(within(dialog).getByRole("button", { name: "Odrzuć" }));
    expect(await screen.findByText("Booking odrzucony.")).toBeInTheDocument();
    expect(sent("POST", /\/decline$/)[0]!.body).toEqual({ reason: "Mamy już kogoś" });
  });

  it("withdraws the own offer", async () => {
    current = booking({ myTurn: false, canWithdraw: true, awaiting: "ARTIST" });
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    expect(
      await screen.findByText("Czekasz na odpowiedź drugiej strony. Bez odpowiedzi booking wygaśnie za 2 dni."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Akceptuj" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wycofaj propozycję" }));
    expect(await screen.findByText("Propozycja wycofana.")).toBeInTheDocument();
  });

  it("needs a reason to cancel an accepted booking", async () => {
    current = booking({ status: "ACCEPTED", myTurn: false, awaiting: undefined, respondBy: undefined });
    const user = userEvent.setup();
    renderUi(<BookingDetail id={booking().id} />);
    await user.click(await screen.findByRole("button", { name: "Anuluj booking" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj booking" }));
    expect(within(dialog).getByText("To pole jest wymagane.")).toBeInTheDocument();
    expect(sent("POST", /\/cancel$/)).toEqual([]);
    await user.type(within(dialog).getByLabelText("Powód"), "Choroba");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj booking" }));
    expect(await screen.findByText("Booking anulowany.")).toBeInTheDocument();
    expect(sent("POST", /\/cancel$/)[0]!.body).toEqual({ reason: "Choroba" });
  });

  it("is a not-found page for anyone outside the booking", async () => {
    current = null;
    renderUi(<BookingDetail id={booking().id} />);
    expect(await screen.findByText("Booking nie istnieje albo nie jesteś jego stroną.")).toBeInTheDocument();
  });
});

describe("BookingCta", () => {
  it("shows each button only to the role that can use it, and to visitors", () => {
    renderUi(
      <>
        <BookingCta target={{ kind: "artist", slug: "dj-ola" }} />
        <BookingCta target={{ kind: "listing", id: "l1", listingKind: "VENUE_SEEKING" }} />
      </>,
    );
    expect(screen.getByRole("link", { name: "Zapytaj o termin" })).toHaveAttribute(
      "href",
      "/bookings/new?artist=dj-ola",
    );
    expect(screen.queryByRole("link", { name: "Zgłoś się" })).not.toBeInTheDocument();
  });

  it("leads visitors to the request (through the login page)", () => {
    signedIn = false;
    renderUi(<BookingCta target={{ kind: "listing", id: "l1", listingKind: "VENUE_SEEKING" }} />);
    expect(screen.getByRole("link", { name: "Zgłoś się" })).toHaveAttribute("href", "/bookings/new?listing=l1");
  });
});
