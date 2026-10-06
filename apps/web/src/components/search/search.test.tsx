import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import type { MapView } from "./map-move";
import type { SearchMapProps } from "./search-map";
import { SearchScreen } from "./search-screen";

let role = "VENUE";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "u1", email: "x@x.pl", role, locale: "pl" } },
  }),
}));

// The URL as a tiny store, so router.replace re-renders like in Next.
const url = vi.hoisted(() => ({
  query: "",
  listeners: new Set<() => void>(),
  lag: false,
  queued: [] as string[],
  commit: () => {},
}));
vi.mock("next/navigation", async () => {
  const React = await import("react");
  const subscribe = (listener: () => void) => {
    url.listeners.add(listener);
    return () => url.listeners.delete(listener);
  };
  const apply = (href: string) => {
    url.query = href.split("?")[1] ?? "";
    url.listeners.forEach((listener) => listener());
  };
  // With `lag`, the address changes only on `url.commit()`, one write at a time, as Next's router does later.
  url.commit = () => {
    const href = url.queued.shift();
    if (href !== undefined) React.startTransition(() => apply(href));
  };
  const go = (href: string) => (url.lag ? url.queued.push(href) : apply(href));
  return {
    usePathname: () => "/search",
    useRouter: () => ({ replace: go, push: go }),
    useSearchParams: () => {
      const query = React.useSyncExternalStore(subscribe, () => url.query);
      return React.useMemo(() => new URLSearchParams(query), [query]);
    },
  };
});

// MapLibre needs WebGL; the fake shows the pins as buttons and lets a test "move" the map.
const map = vi.hoisted(() => ({ props: undefined as SearchMapProps | undefined }));
vi.mock("./search-map-lazy", () => ({
  SearchMap: (props: SearchMapProps) => {
    map.props = props;
    return (
      <div data-testid="map">
        {props.pins.map((pin) => (
          <button key={pin.id} type="button" onClick={() => props.onSelect(pin.id)}>
            {`pin ${pin.title}`}
          </button>
        ))}
      </div>
    );
  },
}));

const artist = (slug: string, overrides: object = {}) => ({
  slug,
  stageName: `DJ ${slug}`,
  city: "Kraków",
  genres: ["TECHNO"],
  rateFrom: 80000,
  rateTo: 150000,
  travelRadiusKm: 50,
  distanceKm: 1.2,
  latitude: 50.06,
  longitude: 19.94,
  ...overrides,
});

const venueHit = {
  slug: "klub",
  name: "Klub",
  type: "CLUB",
  city: "Kraków",
  genres: ["HOUSE"],
  capacity: 300,
  distanceKm: 0.4,
  latitude: 50.0617,
  longitude: 19.9372,
};

const listingHit = {
  id: "0190a5d2-0000-7000-8000-000000000001",
  kind: "VENUE_SEEKING",
  startsAt: "2026-10-16T19:00:00Z",
  endsAt: "2026-10-17T01:00:00Z",
  genres: ["TECHNO"],
  description: "Szukamy na piątek",
  priceTo: 120000,
  city: "Kraków",
  venue: { slug: "klub", name: "Klub" },
  distanceKm: 0.4,
  latitude: 50.0617,
  longitude: 19.9372,
};

const myVenue = {
  id: "v1",
  name: "Pod Ziemią",
  published: true,
  genres: ["TECHNO"],
  address: { street: "Rynek 1", city: "Kraków", latitude: 50.0617, longitude: 19.9372 },
};

let results: Record<string, object[]>;
let total: number | undefined;
let location: object | null;
let fail: string | undefined;
const requests: { path: string; search: URLSearchParams }[] = [];

const problem = (status: number, code: string) =>
  Response.json({ type: "about:blank", title: "Coś poszło nie tak", status, code, requestId: "r1" }, { status });

const fetchMock = vi.fn(async (request: Request) => {
  const { pathname: path, searchParams: search } = new URL(request.url);
  requests.push({ path, search });
  if (path === "/api/v1/venues/mine") return Response.json([myVenue]);
  if (path === "/api/v1/locations/me") return location ? Response.json(location) : problem(404, "LOCATION_NOT_SET");
  if (path === "/api/v1/locations/search")
    return Response.json([{ label: "Gdańsk, pomorskie", city: "Gdańsk", latitude: 54.35, longitude: 18.65 }]);
  const tab = /^\/api\/v1\/search\/(\w+)$/.exec(path)?.[1];
  if (tab) {
    if (fail === tab) return problem(500, "INTERNAL_ERROR");
    const all = results[tab] ?? [];
    const page = Number(search.get("page") ?? 0);
    const size = Number(search.get("size") ?? 20);
    const content = all.slice(page * size, (page + 1) * size);
    const totalElements = total ?? all.length;
    return Response.json({ content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) });
  }
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  role = "VENUE";
  url.query = "";
  url.lag = false;
  url.queued = [];
  map.props = undefined;
  results = {
    artists: [artist("ola"), artist("ala", { distanceKm: 3, genres: ["HOUSE"] })],
    venues: [venueHit],
    listings: [listingHit],
  };
  total = undefined;
  location = { label: "Kraków, małopolskie", city: "Kraków", latitude: 50.06, longitude: 19.94 };
  fail = undefined;
  requests.length = 0;
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderScreen() {
  render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SearchScreen />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const searches = (tab: string) => requests.filter((r) => r.path === `/api/v1/search/${tab}`);
const lastList = (tab: string) =>
  searches(tab)
    .filter((r) => r.search.get("size") === "20")
    .at(-1)!;
const settle = (view: MapView, byUser = true) => map.props!.onSettle(view, byUser);

const krakowView: MapView = {
  center: { lat: 50.06, lng: 19.94 },
  bounds: { north: 50.11, south: 50.01, east: 20.08, west: 19.8 },
  zoom: 11,
};

describe("SearchScreen", () => {
  it("shows a venue account artists around its venue, nearest first", async () => {
    renderScreen();
    const list = await screen.findByRole("list", { name: "Wyniki" });
    const cards = within(list).getAllByRole("listitem");
    expect(within(cards[0]!).getByRole("link", { name: /DJ ola/ })).toHaveAttribute("href", "/a/ola");
    expect(within(cards[0]!).getByText("1,2 km stąd")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("800–1500 zł")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("Dojazd do 50 km")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artyści" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pod Ziemią")).toBeInTheDocument();

    const query = lastList("artists").search;
    expect(query.get("lat")).toBe("50.0617");
    expect(query.get("lng")).toBe("19.9372");
    expect(query.get("radiusKm")).toBe("50");
    // The map asks for the 100 nearest at once.
    expect(searches("artists").some((r) => r.search.get("size") === "100")).toBe(true);
    await waitFor(() => expect(map.props!.pins).toHaveLength(2));
    expect(map.props!.pins[0]).toMatchObject({ title: "DJ ola", href: "/a/ola", approximate: true });
  });

  it("starts an artist on venues' listings around their own location", async () => {
    role = "ARTIST";
    renderScreen();
    const list = await screen.findByRole("list", { name: "Wyniki" });
    expect(within(list).getByRole("link", { name: /Klub/ })).toHaveAttribute("href", `/o/${listingHit.id}`);
    expect(within(list).getByText("do 1200 zł")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ogłoszenia" })).toHaveAttribute("aria-pressed", "true");
    expect(lastList("listings").search.get("kind")).toBe("VENUE_SEEKING");
    expect(lastList("listings").search.get("lat")).toBe("50.06");
    expect(screen.getByText("Kraków, małopolskie")).toBeInTheDocument();
  });

  it("asks for a place when there is none and searches around the picked one", async () => {
    role = "ARTIST";
    location = null;
    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByText(pl.search.needPlace)).toBeInTheDocument();
    expect(searches("listings")).toHaveLength(0);

    await user.type(screen.getByRole("combobox", { name: "Miejsce wyszukiwania" }), "gdań");
    await user.click(await screen.findByRole("option", { name: "Gdańsk, pomorskie" }));
    await screen.findByRole("list", { name: "Wyniki" });
    expect(lastList("listings").search.get("lat")).toBe("54.35");
    expect(url.query).toContain("place=Gda%C5%84sk");
  });

  it("filters by genre and free time, kept in the address", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole("list", { name: "Wyniki" });
    await user.click(screen.getByRole("button", { name: "Techno" }));
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-16" } });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "22:00" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "04:00" } });
    await user.click(screen.getByRole("checkbox", { name: "Tylko ci, którzy dojadą" }));

    await waitFor(() => expect(lastList("artists").search.get("willTravel")).toBe("true"));
    const query = lastList("artists").search;
    expect(query.getAll("genres")).toEqual(["TECHNO"]);
    expect(query.get("from")).toBe("2026-10-16T20:00:00.000Z");
    expect(query.get("to")).toBe("2026-10-17T02:00:00.000Z");
    expect(url.query).toContain("genre=TECHNO");
    expect(url.query).toContain("travel=1");
  });

  it("keeps every filter changed before the address catches up", async () => {
    renderScreen();
    await screen.findByRole("list", { name: "Wyniki" });
    url.lag = true;
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-16" } });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "22:00" } });
    // The first write lands only now, after the second was sent.
    act(() => url.commit());
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "04:00" } });
    act(() => {
      url.commit();
      url.commit();
    });

    await waitFor(() => expect(url.query).toContain("to=04%3A00"));
    expect(url.query).toContain("date=2026-10-16");
    expect(url.query).toContain("from=22%3A00");
  });

  it("switches to venues and pages with 'Pokaż więcej'", async () => {
    results.venues = Array.from({ length: 25 }, (_, i) => ({ ...venueHit, slug: `v${i}`, name: `Lokal ${i}` }));
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole("list", { name: "Wyniki" });
    await user.click(screen.getByRole("button", { name: "Lokale" }));
    const list = await screen.findByRole("list", { name: "Wyniki" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(20));
    expect(within(list).getByRole("link", { name: /Lokal 0/ })).toHaveAttribute("href", "/v/v0");
    expect(screen.getByText("25 wyników")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pokaż więcej" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(25));
    expect(lastList("venues").search.get("page")).toBe("1");
    expect(screen.queryByRole("button", { name: "Pokaż więcej" })).not.toBeInTheDocument();
  });

  it("says when nothing matches and shows errors", async () => {
    results.artists = [];
    renderScreen();
    expect(await screen.findByText(pl.search.empty)).toBeInTheDocument();
  });

  it("shows a failed search with a retry", async () => {
    fail = "artists";
    renderScreen();
    expect(await screen.findByRole("button", { name: "Spróbuj ponownie" })).toBeInTheDocument();
  });

  it("highlights the card of a clicked pin", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "pin DJ ala" }));
    const card = screen.getByRole("link", { name: /DJ ala/ }).closest("li")!;
    expect(card).toHaveAttribute("aria-current", "true");
  });

  it("searches the map area once it settles, skipping small moves", async () => {
    renderScreen();
    await screen.findByRole("list", { name: "Wyniki" });
    await waitFor(() => expect(map.props).toBeDefined());
    settle(krakowView, false);
    const before = searches("artists").length;

    // A small nudge at the same zoom.
    settle({ ...krakowView, center: { lat: 50.065, lng: 19.95 } });
    expect(searches("artists")).toHaveLength(before);

    settle({
      ...krakowView,
      center: { lat: 50.06, lng: 20.2 },
      bounds: { ...krakowView.bounds, east: 20.34, west: 20.06 },
    });
    await waitFor(() => expect(lastList("artists").search.get("lng")).toBe("20.2"));
    expect(lastList("artists").search.get("radiusKm")).toBe("12");
    expect(url.query).toContain("area=1");
    expect(screen.getByText("Obszar mapy")).toBeInTheDocument();
  });

  it("waits for 'Szukaj w tym obszarze' when moving the map does not search", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole("list", { name: "Wyniki" });
    await user.click(screen.getByRole("checkbox", { name: "Szukaj przy przesuwaniu mapy" }));
    await waitFor(() => expect(map.props).toBeDefined());
    settle(krakowView, false);
    settle({ ...krakowView, zoom: 9 });
    const button = await screen.findByRole("button", { name: "Szukaj w tym obszarze" });
    expect(url.query).not.toContain("area=1");

    await user.click(button);
    await waitFor(() => expect(url.query).toContain("area=1"));
    expect(screen.queryByRole("button", { name: "Szukaj w tym obszarze" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("sos.search.autoArea")).toBe("0");
  });

  it("switches between the list and the map on phones", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole("list", { name: "Wyniki" });
    const mapButton = screen.getByRole("button", { name: "Mapa" });
    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
    await user.click(mapButton);
    expect(mapButton).toHaveAttribute("aria-pressed", "true");
  });
});
