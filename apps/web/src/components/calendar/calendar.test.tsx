import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Toaster } from "@spot-on-slot/ui";
import { CalendarScreen } from "./calendar-screen";
import { NextFreeSlots, nextFree } from "./next-free-slots";
import type { Occurrence, Rule } from "./queries";

let role = "ARTIST";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "u1", email: "dj@x.pl", role, locale: "pl" } },
  }),
}));

// Wednesday 14 October 2026, noon in Warsaw.
const NOW = new Date("2026-10-14T10:00:00Z");

const rule = (overrides: Partial<Rule> = {}): Rule => ({
  id: "r1",
  days: ["FRIDAY"],
  startTime: "21:00:00",
  durationMinutes: 360,
  validFrom: "2026-10-01",
  timeZone: "Europe/Warsaw",
  skippedDates: [],
  ...overrides,
});

/** Fridays of the rule within the requested range (Warsaw is UTC+2 until 25 Oct, then UTC+1). */
function ruleDates(r: Rule, from: Date, to: Date): Occurrence[] {
  const fridays = ["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06"];
  return fridays
    .filter((date) => !r.skippedDates.includes(date))
    .map((date) => {
      const offset = date < "2026-10-25" ? 2 : 1;
      const startsAt = new Date(`${date}T${String(21 - offset).padStart(2, "0")}:00:00Z`);
      return {
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + r.durationMinutes * 60_000).toISOString(),
        status: "FREE" as const,
        source: "RULE" as const,
        ruleId: r.id,
        date,
      };
    })
    .filter((o) => new Date(o.startsAt) < to && new Date(o.endsAt) > from);
}

let profile: object | null;
let rules: Rule[];
let slots: Occurrence[];
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
  if (route === "GET /api/v1/artists/me")
    return profile ? Response.json(profile) : problem(404, "ARTIST_PROFILE_NOT_FOUND", "x");
  if (route === "GET /api/v1/availability/me/rules") return Response.json(rules);
  if (route === "GET /api/v1/availability/me") {
    const from = new Date(url.searchParams.get("from")!);
    const to = new Date(url.searchParams.get("to")!);
    const inRange = slots.filter((o) => new Date(o.startsAt) < to && new Date(o.endsAt) > from);
    return Response.json([...inRange, ...rules.flatMap((r) => ruleDates(r, from, to))]);
  }
  if (route === "POST /api/v1/availability/me/slots") {
    return Response.json({ id: "s9", status: "FREE", ...(body as object) }, { status: 201 });
  }
  if (route === "POST /api/v1/availability/me/rules") return Response.json(rule({ id: "r9" }), { status: 201 });
  const date = /\/rules\/(\w+)\/dates\/([\d-]+)$/.exec(path);
  if (date) {
    const current = rules.find((r) => r.id === date[1])!;
    const skipped =
      request.method === "DELETE"
        ? [...current.skippedDates, date[2]!]
        : current.skippedDates.filter((d) => d !== date[2]);
    rules = rules.map((r) => (r.id === current.id ? { ...r, skippedDates: skipped } : r));
    return Response.json({ ...current, skippedDates: skipped });
  }
  const slot = /\/slots\/(\w+)$/.exec(path)?.[1];
  if (request.method === "DELETE" && slot) {
    slots = slots.filter((s) => s.slotId !== slot);
    return new Response(null, { status: 204 });
  }
  const ruleId = /\/rules\/(\w+)$/.exec(path)?.[1];
  if (request.method === "DELETE" && ruleId) {
    rules = rules.filter((r) => r.id !== ruleId);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  role = "ARTIST";
  profile = { id: "p1" };
  rules = [rule()];
  slots = [
    {
      startsAt: "2026-10-17T20:00:00Z",
      endsAt: "2026-10-18T01:00:00Z",
      status: "BOOKED",
      note: "Klub Pod Ziemią",
      source: "SLOT",
      slotId: "s1",
      bookingId: "b1",
    },
    {
      startsAt: "2026-10-20T17:00:00Z",
      endsAt: "2026-10-20T21:00:00Z",
      status: "FREE",
      note: "tylko Kraków",
      source: "SLOT",
      slotId: "s2",
    },
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

function renderScreen(node: ReactNode = <CalendarScreen />) {
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

const day = (name: RegExp) => screen.findByRole("button", { name });

describe("CalendarScreen, month", () => {
  it("colours days with free time, marks bookings and lists the chosen day", async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByRole("heading", { name: "październik 2026" })).toBeInTheDocument();
    expect(await day(/^16 października 2026, wolny termin$/)).toHaveAttribute("data-state", "available");
    expect(await day(/^17 października 2026, niedostępny, zarezerwowany$/)).toHaveAttribute("data-booked", "true");
    expect(await day(/^14 października 2026, niedostępny, wybrany$/)).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText(pl.calendar.emptyDay)).toBeInTheDocument();

    await user.click(await day(/^16 października 2026/));
    const entry = (await screen.findByText("21:00–03:00")).closest("li")!;
    expect(within(entry).getByText("+1 dzień")).toBeInTheDocument();
    expect(within(entry).getByText("Co tydzień")).toBeInTheDocument();
  });

  it("keeps booked time read-only and links it to its booking", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await day(/^17 października 2026/));
    const entry = (await screen.findByText("22:00–03:00")).closest("li")!;
    expect(within(entry).getByText(pl.calendar.bookedHint)).toBeInTheDocument();
    expect(within(entry).queryByRole("button")).not.toBeInTheDocument();
    expect(within(entry).getByRole("link", { name: "Zobacz booking" })).toHaveAttribute("href", "/bookings/b1");
  });

  it("adds a single slot across midnight", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Dodaj wolny termin" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Dzień")).toHaveValue("2026-10-14");
    await user.clear(within(dialog).getByLabelText("Od"));
    await user.type(within(dialog).getByLabelText("Od"), "22:00");
    await user.clear(within(dialog).getByLabelText("Do"));
    await user.type(within(dialog).getByLabelText("Do"), "04:00");
    expect(within(dialog).getByText("Długość: 6 h · kończy się następnego dnia")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Notatka (tylko dla Ciebie)"), "tylko Kraków");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent("POST", /\/me\/slots$/)[0]!.body).toEqual({
      startsAt: "2026-10-14T20:00:00.000Z",
      endsAt: "2026-10-15T02:00:00.000Z",
      note: "tylko Kraków",
    });
  });

  it("adds a weekly rule on the chosen weekdays", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Dodaj wolny termin" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: "Powtarzaj co tydzień" }));
    expect(within(dialog).getByRole("button", { name: "Środa" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Sobota" }));
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    await waitFor(() => expect(sent("POST", /\/me\/rules$/)).toHaveLength(1));
    expect(sent("POST", /\/me\/rules$/)[0]!.body).toEqual({
      days: ["WEDNESDAY", "SATURDAY"],
      startTime: "21:00",
      durationMinutes: 360,
      validFrom: "2026-10-14",
    });
  });

  it("shows an overlap from the backend in the dialog", async () => {
    reply = (method, path) =>
      method === "POST" && path.endsWith("/slots")
        ? problem(409, "AVAILABILITY_OVERLAP", "Ten czas nachodzi na Twój termin od 16.10.2026 21:00.")
        : undefined;
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Dodaj wolny termin" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    expect(await within(dialog).findByText(/nachodzi na Twój termin od 16.10.2026 21:00/)).toBeInTheDocument();
  });

  it("skips one date of a rule and restores it", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await day(/^16 października 2026/));
    await user.click(await screen.findByRole("button", { name: "Pomiń termin 21:00–03:00 w tym dniu" }));
    await waitFor(() => expect(sent("DELETE", /\/rules\/r1\/dates\/2026-10-16$/)).toHaveLength(1));

    const skipped = (await screen.findByText("Pominięty")).closest("li")!;
    expect(skipped).toHaveAttribute("data-status", "skipped");
    expect(await day(/^16 października 2026, niedostępny, wybrany$/)).toBeInTheDocument();
    await user.click(within(skipped).getByRole("button", { name: "Przywróć termin 21:00–03:00 w tym dniu" }));
    await waitFor(() => expect(sent("PUT", /\/rules\/r1\/dates\/2026-10-16$/)).toHaveLength(1));
  });

  it("edits and deletes a single slot", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await day(/^20 października 2026/));
    await user.click(await screen.findByRole("button", { name: "Edytuj termin 19:00–23:00" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Od")).toHaveValue("19:00");
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(await screen.findByRole("button", { name: "Usuń termin 19:00–23:00" }));
    await waitFor(() => expect(sent("DELETE", /\/slots\/s2$/)).toHaveLength(1));
    expect(await screen.findByText(pl.calendar.emptyDay)).toBeInTheDocument();
  });
});

describe("CalendarScreen, week and rules", () => {
  it("lists the seven days of the week and moves between weeks", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Tydzień" }));
    const days = await screen.findAllByRole("listitem", { name: /października|listopada/ });
    expect(days.filter((item) => item.tagName === "LI" && item.closest("ol"))).toHaveLength(7);
    const friday = screen.getByRole("listitem", { name: "piątek, 16 października" });
    expect(await within(friday).findByText("21:00–03:00")).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "poniedziałek, 12 października" })).getByText("Niedostępny"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Następny tydzień" }));
    await waitFor(() =>
      expect(
        requests.some(
          (r) => r.path === "/api/v1/availability/me" && r.search.get("from") === "2026-10-18T22:00:00.000Z",
        ),
      ).toBe(true),
    );
    expect(await screen.findByRole("listitem", { name: "wtorek, 20 października" })).toBeInTheDocument();
  });

  it("shows the weekly rules and deletes one", async () => {
    const user = userEvent.setup();
    renderScreen();
    const list = await screen.findByRole("list", { name: "Stałe terminy" });
    expect(within(list).getByText("Pt · 21:00–03:00")).toBeInTheDocument();
    expect(within(list).getByText("od 1 paź 2026")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Usuń stały termin Pt · 21:00–03:00" }));
    await waitFor(() => expect(sent("DELETE", /\/rules\/r1$/)).toHaveLength(1));
    expect(await screen.findByText(/Nie masz stałych terminów/)).toBeInTheDocument();
  });
});

describe("CalendarScreen, other states", () => {
  it("asks for a profile first", async () => {
    profile = null;
    renderScreen();
    expect(await screen.findByText(pl.calendar.noProfile)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Utwórz profil" })).toHaveAttribute("href", "/onboarding");
  });

  it("tells venues their calendar comes later", async () => {
    role = "VENUE";
    renderScreen();
    expect(await screen.findByText(pl.calendar.otherRole)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});

describe("NextFreeSlots", () => {
  const free = (startsAt: string, status: "FREE" | "BOOKED" = "FREE") => ({
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    status,
  });

  it("keeps the first free time of each coming day, at most six", () => {
    const list = nextFree(
      [
        free("2026-10-16T19:00:00Z"),
        free("2026-10-14T08:00:00Z"),
        free("2026-10-16T20:30:00Z"),
        free("2026-10-15T19:00:00Z", "BOOKED"),
        ...["17", "18", "19", "20", "21", "22"].map((d) => free(`2026-10-${d}T19:00:00Z`)),
      ],
      NOW,
    );
    expect(list.map((o) => o.startsAt)).toEqual([
      "2026-10-16T19:00:00Z",
      "2026-10-17T19:00:00Z",
      "2026-10-18T19:00:00Z",
      "2026-10-19T19:00:00Z",
      "2026-10-20T19:00:00Z",
      "2026-10-21T19:00:00Z",
    ]);
  });

  it("shows the dates on the profile, or that there are none", () => {
    renderScreen(<NextFreeSlots occurrences={[free("2026-10-16T19:00:00Z")]} now={NOW} />);
    const panel = screen.getByRole("heading", { name: "Najbliższe wolne terminy" }).closest("section")!;
    expect(within(panel).getByText("16 paź")).toBeInTheDocument();
    expect(within(panel).getByText("21:00")).toBeInTheDocument();
  });

  it("says when nothing is free", () => {
    renderScreen(<NextFreeSlots occurrences={[]} now={NOW} />);
    expect(screen.getByText(pl.artistProfile.view.noSlots)).toBeInTheDocument();
  });
});
