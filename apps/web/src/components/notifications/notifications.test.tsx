import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Toaster } from "@spot-on-slot/ui";
import { NotificationBell } from "./notification-bell";
import { NotificationList } from "./notification-list";
import { NotificationSettings } from "./notification-settings";
import type { AppNotification, NotificationPreferences } from "./queries";
import { UnsubscribeCard } from "./unsubscribe-card";

const NOW = new Date("2026-10-14T10:00:00Z");

const notification = (
  overrides: Partial<AppNotification> = {},
): AppNotification => ({
  id: "n1",
  type: "NEARBY_LISTING",
  createdAt: "2026-10-14T09:00:00Z",
  active: true,
  nearbyListing: {
    listingId: "l1",
    kind: "VENUE_SEEKING",
    authorName: "Klub",
    authorSlug: "klub",
    city: "Kraków",
    startsAt: "2026-10-16T20:00:00Z",
    endsAt: "2026-10-17T02:00:00Z",
    genres: ["TECHNO"],
    priceTo: 150000,
    distanceKm: 3,
    free: true,
  },
  ...overrides,
});

let notifications: AppNotification[];
let preferences: NotificationPreferences;
let unsubscribeStatus: number;
const requests: { method: string; path: string; body?: unknown }[] = [];

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const text = request.method !== "GET" ? await request.text() : "";
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path, body });
  const route = `${request.method} ${path}`;
  if (route === "GET /api/v1/notifications")
    return Response.json({
      content: notifications,
      page: 0,
      size: 20,
      totalElements: notifications.length,
      totalPages: 1,
    });
  if (route === "GET /api/v1/notifications/unread-count")
    return Response.json({
      count: notifications.filter((n) => n.readAt == null).length,
    });
  if (route === "POST /api/v1/notifications/read-all") {
    notifications = notifications.map((n) => ({
      ...n,
      readAt: NOW.toISOString(),
    }));
    return new Response(null, { status: 204 });
  }
  const read = /^POST \/api\/v1\/notifications\/([\w-]+)\/read$/.exec(
    route,
  )?.[1];
  if (read) {
    notifications = notifications.map((n) =>
      n.id === read ? { ...n, readAt: NOW.toISOString() } : n,
    );
    return new Response(null, { status: 204 });
  }
  if (route === "GET /api/v1/notifications/preferences")
    return Response.json(preferences);
  if (route === "PUT /api/v1/notifications/preferences") {
    const saved = (
      body as { nearbyListings: NotificationPreferences["nearbyListings"] }
    ).nearbyListings;
    preferences = {
      ...preferences,
      nearbyListings: { ...preferences.nearbyListings, ...saved },
    };
    return Response.json(preferences);
  }
  if (route === "POST /api/v1/public/notifications/unsubscribe") {
    return unsubscribeStatus === 204
      ? new Response(null, { status: 204 })
      : Response.json(
          {
            title: "x",
            status: 404,
            code: "NOTIFICATION_UNSUBSCRIBE_INVALID",
            requestId: "r",
          },
          { status: 404 },
        );
  }
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  notifications = [notification()];
  preferences = {
    nearbyListings: {
      enabled: true,
      email: true,
      genres: [],
      defaultRadiusKm: 80,
      defaultGenres: ["TECHNO", "HOUSE"],
    },
    messages: { email: true },
  };
  unsubscribeStatus = 204;
  requests.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderUi(node: ReactNode) {
  render(
    <NextIntlClientProvider
      locale="pl"
      messages={pl}
      timeZone="Europe/Warsaw"
      now={NOW}
    >
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {node}
        <Toaster />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const sent = (method: string, path: string) =>
  requests.filter((r) => r.method === method && r.path === path);

describe("NotificationList", () => {
  it("shows a listing alert with its time, place, genres and money, linking to the listing", async () => {
    renderUi(<NotificationList />);
    const link = await screen.findByRole("link", {
      name: /Klub szuka artysty/,
    });
    expect(link).toHaveAttribute("href", "/o/l1");
    expect(
      within(link).getByText("pt., 16 października · 22:00–04:00 +1"),
    ).toBeInTheDocument();
    expect(
      within(link).getByText("Kraków, 3 km od Ciebie · Techno · do 1500 zł"),
    ).toBeInTheDocument();
    expect(within(link).getByText("Nowe")).toBeInTheDocument();
    expect(within(link).getByText("Masz wtedy wolne")).toBeInTheDocument();
  });

  it("names the venue for venue teams and greys out ended listings", async () => {
    notifications = [
      notification({
        active: false,
        readAt: "2026-10-14T09:30:00Z",
        nearbyListing: {
          ...notification().nearbyListing!,
          kind: "ARTIST_AVAILABLE",
          authorName: "DJ Ola",
          venueName: "Klub",
          free: undefined,
        },
      }),
    ];
    renderUi(<NotificationList />);
    const link = await screen.findByRole("link", {
      name: /DJ Ola ma wolny termin/,
    });
    expect(
      within(link).getByText(/Kraków, 3 km od lokalu Klub/),
    ).toBeInTheDocument();
    expect(within(link).getByText("Nieaktualne")).toBeInTheDocument();
    expect(within(link).queryByText("Nowe")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Oznacz wszystkie jako przeczytane",
      }),
    ).not.toBeInTheDocument();
  });

  it("marks one read when opened and all read on request", async () => {
    notifications = [notification(), notification({ id: "n2" })];
    const user = userEvent.setup();
    renderUi(<NotificationList />);
    const [first] = await screen.findAllByRole("link", {
      name: /Klub szuka artysty/,
    });
    first!.addEventListener("click", (event) => event.preventDefault());
    await user.click(first!);
    await waitFor(() =>
      expect(sent("POST", "/api/v1/notifications/n1/read")).toHaveLength(1),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Oznacz wszystkie jako przeczytane",
      }),
    );
    await waitFor(() =>
      expect(sent("POST", "/api/v1/notifications/read-all")).toHaveLength(1),
    );
    await waitFor(() =>
      expect(screen.queryByText("Nowe")).not.toBeInTheDocument(),
    );
  });

  it("tells booking steps from the viewer's side and links to the booking", async () => {
    const booking = (kind: string, by: string, id: string) =>
      notification({
        id,
        type: "BOOKING",
        nearbyListing: undefined,
        booking: {
          bookingId: `b-${id}`,
          kind: kind as "REQUESTED",
          by: by as "VENUE",
          otherName: "Klub",
          startsAt: "2026-10-16T20:00:00Z",
          endsAt: "2026-10-17T02:00:00Z",
          amount: id === "n3" ? 0 : 150000,
        },
      });
    notifications = [
      booking("REQUESTED", "VENUE", "n1"),
      booking("DECLINED", "SYSTEM", "n2"),
      booking("CANCELLED", "VENUE", "n3"),
    ];
    renderUi(<NotificationList />);
    const request = await screen.findByRole("link", { name: /Klub pyta o termin/ });
    expect(request).toHaveAttribute("href", "/bookings/b-n1");
    expect(within(request).getByText("pt., 16 października · 22:00–04:00 +1")).toBeInTheDocument();
    expect(within(request).getByText("Booking · 1500 zł")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Klub ma już booking w tym terminie/ })).toBeInTheDocument();
    const cancelled = screen.getByRole("link", { name: /Klub odwołuje booking/ });
    expect(within(cancelled).getByText("Booking · Bez honorarium")).toBeInTheDocument();
  });

  it("says when there is nothing yet", async () => {
    notifications = [];
    renderUi(<NotificationList />);
    expect(await screen.findByText(/Nic nowego/)).toBeInTheDocument();
  });
});

describe("NotificationBell", () => {
  it("shows the unread count and links to the list on mobile", async () => {
    notifications = [
      notification(),
      notification({ id: "n2" }),
      notification({ id: "n3", readAt: "x" }),
    ];
    renderUi(<NotificationBell variant="link" />);
    const link = await screen.findByRole("link", {
      name: "Powiadomienia: 2 nieprzeczytane",
    });
    expect(link).toHaveAttribute("href", "/notifications");
    expect(within(link).getByText("2")).toBeInTheDocument();
  });

  it("opens the list beside the page on desktop", async () => {
    const user = userEvent.setup();
    renderUi(<NotificationBell variant="panel" />);
    await user.click(
      await screen.findByRole("button", {
        name: "Powiadomienia: 1 nieprzeczytane",
      }),
    );
    const panel = await screen.findByRole("dialog", { name: "Powiadomienia" });
    expect(
      await within(panel).findByRole("link", { name: /Klub szuka artysty/ }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "Ustawienia powiadomień" }),
    ).toHaveAttribute("href", "/settings#notifications");
  });
});

describe("NotificationSettings", () => {
  it("shows the profile defaults and saves the choices", async () => {
    const user = userEvent.setup();
    renderUi(<NotificationSettings />);
    expect(
      await screen.findByText(
        "Bez wyboru liczą się gatunki z profilu: Techno, House.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Promień" })).toHaveTextContent(
      "Domyślny (80 km)",
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: "Wysyłaj je też e-mailem (najwyżej 5 dziennie)",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Drum and bass" }));
    await user.click(
      screen.getByRole("checkbox", { name: "E-maile o nieprzeczytanych wiadomościach" }),
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    await waitFor(() =>
      expect(sent("PUT", "/api/v1/notifications/preferences")).toHaveLength(1),
    );
    expect(sent("PUT", "/api/v1/notifications/preferences")[0]!.body).toEqual({
      nearbyListings: {
        enabled: true,
        email: false,
        genres: ["DRUM_AND_BASS"],
      },
      messages: { email: false },
    });
    expect(
      await screen.findByText("Zapisano ustawienia powiadomień"),
    ).toBeInTheDocument();
  });

  it("turning alerts off disables e-mail and the radius", async () => {
    const user = userEvent.setup();
    renderUi(<NotificationSettings />);
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Powiadamiaj o nowych ogłoszeniach w okolicy",
      }),
    );
    expect(
      screen.getByRole("checkbox", {
        name: "Wysyłaj je też e-mailem (najwyżej 5 dziennie)",
      }),
    ).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Promień" })).toBeDisabled();
  });
});

describe("UnsubscribeCard", () => {
  it("switches e-mails off only after the button is pressed", async () => {
    const user = userEvent.setup();
    renderUi(<UnsubscribeCard token="tok" />);
    expect(
      sent("POST", "/api/v1/public/notifications/unsubscribe"),
    ).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Wyłącz e-maile" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Gotowe/);
    expect(
      sent("POST", "/api/v1/public/notifications/unsubscribe")[0]!.body,
    ).toEqual({ token: "tok" });
  });

  it("explains an unknown or missing link", async () => {
    unsubscribeStatus = 404;
    const user = userEvent.setup();
    renderUi(<UnsubscribeCard token="nope" />);
    await user.click(screen.getByRole("button", { name: "Wyłącz e-maile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nieprawidłowy/);
  });

  it("asks to reopen the e-mail without a code", () => {
    renderUi(<UnsubscribeCard token={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/brakuje kodu/);
    expect(
      screen.queryByRole("button", { name: "Wyłącz e-maile" }),
    ).not.toBeInTheDocument();
  });
});
