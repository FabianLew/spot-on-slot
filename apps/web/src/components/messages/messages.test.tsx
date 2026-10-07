import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Toaster } from "@spot-on-slot/ui";
import { useNavBadge } from "@/components/navigation/nav-badges";
import type { LiveOptions } from "./live-client";
import { LiveMessages } from "./live-messages";
import { MessageCta } from "./message-cta";
import { MessagesScreen } from "./messages-screen";
import { NewMessageScreen } from "./new-message-screen";
import type { Conversation, Message } from "./queries";

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

// The live connection is replaced by a stand-in that hands its callbacks to the test.
let live: LiveOptions | null = null;
const disconnect = vi.fn();
vi.mock("./live-client", async (original) => ({
  ...(await original<typeof import("./live-client")>()),
  connectLive: (options: LiveOptions) => {
    live = options;
    return disconnect;
  },
}));

// Wednesday 14 October 2026, noon in Warsaw (UTC+2 until 25 October).
const NOW = new Date("2026-10-14T10:00:00Z");
const C1 = "0190a5d2-0000-7000-8000-0000000000c1";
const C2 = "0190a5d2-0000-7000-8000-0000000000c2";

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  conversationId: C1,
  side: "ARTIST",
  mine: false,
  body: "Cześć!",
  createdAt: "2026-10-14T09:00:00Z",
  deleted: false,
  ...overrides,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: C1,
  kind: "DIRECT",
  venueId: "v1",
  myParty: "VENUE",
  other: { name: "DJ Ola", slug: "dj-ola" },
  lastMessage: message(),
  unreadCount: 1,
  blockedByMe: false,
  blockedByOther: false,
  canWrite: true,
  lastMessageAt: "2026-10-14T09:00:00Z",
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

let venues: object[];
let artistProfile: object | null;
let conversations: Conversation[];
let current: Conversation | null;
let history: Message[];
let unread: number;
let reply: ((method: string, path: string, body: unknown, search: URLSearchParams) => Response | Promise<Response> | undefined) | undefined;
const requests: { method: string; path: string; search: URLSearchParams; body?: unknown }[] = [];

const problem = (status: number, code: string, detail: string) =>
  Response.json({ type: "about:blank", title: "x", detail, status, code, requestId: "r" }, { status });

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const text = request.method !== "GET" ? await request.text() : "";
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path, search: url.searchParams, body });
  const custom = await reply?.(request.method, path, body, url.searchParams);
  if (custom) return custom;
  const route = `${request.method} ${path}`;
  if (route === "GET /api/v1/venues/mine") return Response.json(venues);
  if (route === "GET /api/v1/artists/me") {
    return artistProfile ? Response.json(artistProfile) : problem(404, "ARTIST_PROFILE_NOT_FOUND", "x");
  }
  if (route === "GET /api/v1/public/artists/dj-ola") return Response.json({ stageName: "DJ Ola", slug: "dj-ola" });
  if (route === "GET /api/v1/public/venues/klub-x") return Response.json({ name: "Klub X", slug: "klub-x" });
  if (route === "GET /api/v1/conversations/unread-count") return Response.json({ conversations: unread, messages: unread });
  if (route === "GET /api/v1/conversations") {
    const venueId = url.searchParams.get("venueId");
    const list = conversations.filter((item) => venueId == null || item.venueId === venueId);
    return Response.json({ content: list, page: 0, size: 20, totalElements: list.length });
  }
  if (route === "POST /api/v1/conversations") return Response.json(conversation({ id: C2 }), { status: 201 });
  if (route === `GET /api/v1/conversations/${C1}`) {
    return current ? Response.json(current) : problem(404, "MESSAGING_CONVERSATION_NOT_FOUND", "x");
  }
  if (route === `GET /api/v1/conversations/${C1}/messages`) {
    return Response.json({ messages: history, hasMore: false, otherReadUpTo: current?.otherReadUpTo });
  }
  if (route === `POST /api/v1/conversations/${C1}/messages`) {
    const sent = body as { body: string; clientId: string };
    return Response.json(
      message({ id: `s-${sent.clientId}`, mine: true, side: "VENUE", body: sent.body, clientId: sent.clientId, createdAt: NOW.toISOString() }),
      { status: 201 },
    );
  }
  if (route === `POST /api/v1/conversations/${C1}/read`) return new Response(null, { status: 204 });
  if (path === `/api/v1/conversations/${C1}/block` && current) {
    const on = request.method === "PUT";
    current = { ...current, blockedByMe: on, canWrite: !on };
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
  artistProfile = { id: "p1", published: true, missingForPublication: [] };
  conversations = [conversation()];
  current = conversation();
  history = [message()];
  unread = 1;
  reply = undefined;
  live = null;
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

describe("MessagesScreen, the list", () => {
  it("lists conversations with excerpt, time, unread counter and the booking tag", async () => {
    conversations = [
      conversation(),
      conversation({
        id: C2,
        kind: "BOOKING",
        bookingId: "b1",
        bookingStartsAt: "2026-10-23T19:00:00Z",
        other: { name: "MC Kot", slug: "mc-kot" },
        lastMessage: message({ id: "m9", conversationId: C2, mine: true, side: "VENUE", body: "Do zobaczenia", createdAt: "2026-10-12T18:00:00Z" }),
        unreadCount: 0,
      }),
    ];
    renderUi(<MessagesScreen />);
    const list = await screen.findByRole("list", { name: "Rozmowy" });
    const [first, second] = within(list).getAllByRole("link");
    expect(first).toHaveAttribute("href", `/messages/${C1}`);
    expect(first).toHaveTextContent("DJ Ola");
    expect(first).toHaveTextContent("Cześć!");
    expect(first).toHaveTextContent("11:00");
    expect(first).toHaveTextContent("1 nieprzeczytana wiadomość");
    expect(second).toHaveTextContent("Booking · 23 paź");
    expect(second).toHaveTextContent("Ty: Do zobaczenia");
    expect(second).toHaveTextContent("12 paź");
    expect(screen.getByText("Wybierz rozmowę z listy.")).toBeInTheDocument();
  });

  it("narrows the list to one venue of a multi-venue account", async () => {
    venues = [venue(), venue({ id: "v2", name: "Klub Y" })];
    conversations = [conversation(), conversation({ id: C2, venueId: "v2", other: { name: "MC Kot" } })];
    const user = userEvent.setup();
    renderUi(<MessagesScreen venueId="v2" />);
    const list = await screen.findByRole("list", { name: "Rozmowy" });
    expect(within(list).getAllByRole("link")).toHaveLength(1);
    expect(within(list).getByRole("link")).toHaveAttribute("href", `/messages/${C2}?venue=v2`);
    expect(sent("GET", /\/conversations$/).at(-1)!.search.get("venueId")).toBe("v2");

    await user.click(screen.getByRole("combobox", { name: "Lokal" }));
    await user.click(await screen.findByRole("option", { name: "Wszystkie lokale" }));
    expect(replace).toHaveBeenCalledWith("/messages", { scroll: false });
  });

  it("explains how to start when there is nothing yet", async () => {
    conversations = [];
    renderUi(<MessagesScreen />);
    expect(await screen.findByText("Nie masz jeszcze żadnej rozmowy.")).toBeInTheDocument();
    expect(screen.getByText("Znajdź artystę i kliknij „Napisz” na jego profilu.")).toBeInTheDocument();
  });

  it("tells other roles that messages are for artists and venues", () => {
    role = "ADMIN";
    renderUi(<MessagesScreen />);
    expect(screen.getByText("Wiadomości są dla kont artystów i lokali.")).toBeInTheDocument();
  });
});

describe("MessagesScreen, a conversation", () => {
  it("shows the history by day, marks it read and shows the other side's read mark", async () => {
    current = conversation({ otherReadUpTo: "2026-10-13T20:05:00Z" });
    history = [
      message({ id: "m4", body: "Pasuje piątek?", createdAt: "2026-10-14T09:00:00Z" }),
      message({ id: "m3", mine: true, side: "VENUE", body: "Drugie pytanie", createdAt: "2026-10-13T20:10:00Z" }),
      message({ id: "m2", mine: true, side: "VENUE", body: "Zagrasz u nas?", createdAt: "2026-10-13T20:00:00Z" }),
    ];
    renderUi(<MessagesScreen conversationId={C1} />);
    const log = await screen.findByRole("log", { name: "Historia rozmowy" });
    const yesterday = within(log).getByRole("region", { name: "Wczoraj" });
    expect(within(yesterday).getByText("Zagrasz u nas?")).toBeInTheDocument();
    // Read up to 22:05: the first message only.
    expect(within(yesterday).getByText("22:00").parentElement).toHaveTextContent("22:00 · Przeczytane");
    expect(within(yesterday).getByText("22:10").parentElement).not.toHaveTextContent("Przeczytane");
    expect(within(log).getByRole("region", { name: "Dziś" })).toHaveTextContent("Pasuje piątek?");

    await waitFor(() => expect(sent("POST", /\/read$/)).toHaveLength(1));
    expect(sent("POST", /\/read$/)[0]!.body).toEqual({ messageId: "m4" });
    // The header links the artist's profile.
    expect(screen.getByRole("link", { name: "DJ Ola" })).toHaveAttribute("href", "/a/dj-ola");
  });

  it("shows a message as sending at once, then stores it", async () => {
    let answer!: (response: Response) => void;
    reply = (method, path) =>
      method === "POST" && path.endsWith("/messages") ? new Promise<Response>((resolve) => (answer = resolve)) : undefined;
    const user = userEvent.setup();
    renderUi(<MessagesScreen conversationId={C1} />);
    const field = await screen.findByRole("textbox", { name: "Wiadomość" });
    await user.type(field, "Linia 1{Shift>}{Enter}{/Shift}Linia 2{Enter}");

    expect(await screen.findByText("Wysyłanie…")).toBeInTheDocument();
    expect(field).toHaveValue("");
    const request = sent("POST", /\/messages$/)[0]!.body as { body: string; clientId: string };
    expect(request.body).toBe("Linia 1\nLinia 2");
    answer(
      Response.json(
        message({ id: "s1", mine: true, side: "VENUE", body: request.body, clientId: request.clientId, createdAt: NOW.toISOString() }),
        { status: 201 },
      ),
    );
    await waitFor(() => expect(screen.queryByText("Wysyłanie…")).not.toBeInTheDocument());
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "Linia 1\nLinia 2")).toBeInTheDocument();
  });

  it("offers a retry after a failure and sends the same client id again", async () => {
    let fail = true;
    reply = (method, path) => {
      if (method === "POST" && path.endsWith("/messages") && fail) {
        fail = false;
        throw new TypeError("Failed to fetch");
      }
      return undefined;
    };
    const user = userEvent.setup();
    renderUi(<MessagesScreen conversationId={C1} />);
    await user.type(await screen.findByRole("textbox", { name: "Wiadomość" }), "Halo{Enter}");
    expect(await screen.findByText("Nie wysłano")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    await waitFor(() => expect(screen.queryByText("Nie wysłano")).not.toBeInTheDocument());
    const [first, second] = sent("POST", /\/messages$/).map((r) => r.body as { clientId: string });
    expect(second!.clientId).toBe(first!.clientId);
    expect(screen.getByText("Halo")).toBeInTheDocument();
  });

  it("shows the rate limit at the field", async () => {
    reply = (method, path) =>
      method === "POST" && path.endsWith("/messages")
        ? problem(422, "MESSAGING_RATE", "Za dużo wiadomości naraz. Odczekaj chwilę.")
        : undefined;
    const user = userEvent.setup();
    renderUi(<MessagesScreen conversationId={C1} />);
    await user.type(await screen.findByRole("textbox", { name: "Wiadomość" }), "Halo{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Za dużo wiadomości naraz. Odczekaj chwilę.");
    expect(screen.getByText("Nie wysłano")).toBeInTheDocument();
  });

  it("shows the counter near the limit", async () => {
    const user = userEvent.setup();
    renderUi(<MessagesScreen conversationId={C1} />);
    const field = await screen.findByRole("textbox", { name: "Wiadomość" });
    await user.click(field);
    await user.paste("x".repeat(1799));
    expect(screen.queryByText("1799 / 2000")).not.toBeInTheDocument();
    await user.paste("x");
    expect(screen.getByText("1800 / 2000")).toBeInTheDocument();
  });

  it("shows a deleted account's messages as deleted", async () => {
    current = conversation({ other: { name: "Usunięte konto" } });
    history = [message({ id: "m7", body: "", deleted: true })];
    conversations = [conversation({ other: { name: "Usunięte konto" }, lastMessage: history[0] })];
    renderUi(<MessagesScreen conversationId={C1} />);
    const log = await screen.findByRole("log", { name: "Historia rozmowy" });
    expect(within(log).getByText("Wiadomość usunięta")).toBeInTheDocument();
    const item = within(screen.getByRole("list", { name: "Rozmowy" })).getByRole("link");
    expect(item).toHaveTextContent("Usunięte konto");
    expect(item).toHaveTextContent("Wiadomość usunięta");
  });

  it("loads older messages", async () => {
    reply = (method, path, _body, search) => {
      if (method !== "GET" || !path.endsWith("/messages")) return;
      return search.get("before") === "m5"
        ? Response.json({ messages: [message({ id: "m1", body: "Najstarsza", createdAt: "2026-10-01T10:00:00Z" })], hasMore: false })
        : Response.json({ messages: [message({ id: "m5", body: "Nowsza" })], hasMore: true });
    };
    const user = userEvent.setup();
    renderUi(<MessagesScreen conversationId={C1} />);
    await user.click(await screen.findByRole("button", { name: "Wcześniejsze wiadomości" }));
    expect(await screen.findByText("Najstarsza")).toBeInTheDocument();
    expect(sent("GET", /\/messages$/).at(-1)!.search.get("size")).toBe("50");
    expect(screen.queryByRole("button", { name: "Wcześniejsze wiadomości" })).not.toBeInTheDocument();
  });

  it("blocks a direct conversation and unblocks it", async () => {
    const user = userEvent.setup();
    renderUi(<MessagesScreen conversationId={C1} />);
    await user.click(await screen.findByRole("button", { name: "Opcje rozmowy" }));
    await user.click(await screen.findByRole("menuitem", { name: "Zablokuj" }));
    expect(await screen.findByText("W tej rozmowie nie można teraz pisać.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Wiadomość" })).not.toBeInTheDocument();
    expect(sent("PUT", /\/block$/)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Odblokuj" }));
    expect(await screen.findByRole("textbox", { name: "Wiadomość" })).toBeInTheDocument();
    expect(sent("DELETE", /\/block$/)).toHaveLength(1);
  });

  it("has no block menu in a booking thread, only the booking link", async () => {
    current = conversation({ kind: "BOOKING", bookingId: "b1" });
    renderUi(<MessagesScreen conversationId={C1} />);
    expect(await screen.findByRole("link", { name: "Zobacz booking" })).toHaveAttribute("href", "/bookings/b1");
    expect(screen.queryByRole("button", { name: "Opcje rozmowy" })).not.toBeInTheDocument();
  });

  it("says when blocked by the other side, without unblocking", async () => {
    current = conversation({ blockedByOther: true, canWrite: false });
    renderUi(<MessagesScreen conversationId={C1} />);
    expect(await screen.findByText("W tej rozmowie nie można teraz pisać.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Odblokuj" })).not.toBeInTheDocument();
  });

  it("says when the conversation is not the caller's", async () => {
    current = null;
    renderUi(<MessagesScreen conversationId={C1} />);
    expect(await screen.findByText("Nie ma takiej rozmowy")).toBeInTheDocument();
  });
});

describe("LiveMessages", () => {
  it("connects once and puts pushed messages and read marks into the open conversation", async () => {
    history = [message({ id: "m2", mine: true, side: "VENUE", body: "Zagrasz u nas?", createdAt: "2026-10-14T09:30:00Z" })];
    current = conversation({ unreadCount: 0 });
    renderUi(
      <>
        <LiveMessages />
        <MessagesScreen conversationId={C1} />
      </>,
    );
    expect(await screen.findByText("Zagrasz u nas?")).toBeInTheDocument();
    expect(live).not.toBeNull();
    expect(screen.queryByText(/Przeczytane/)).not.toBeInTheDocument();

    act(() =>
      live!.onEvent({ type: "READ", conversationId: C1, side: "ARTIST", readUpTo: "2026-10-14T09:30:00Z", messageId: "m2" }),
    );
    expect(await screen.findByText(/Przeczytane/)).toBeInTheDocument();

    act(() =>
      live!.onEvent({
        type: "MESSAGE",
        conversationId: C1,
        message: message({ id: "m3", body: "Jasne, gram!", createdAt: "2026-10-14T09:45:00Z" }),
      }),
    );
    expect(await screen.findByText("Jasne, gram!")).toBeInTheDocument();
    // The open conversation marks the new message read.
    await waitFor(() => expect(sent("POST", /\/read$/).at(-1)?.body).toEqual({ messageId: "m3" }));

    // After a reconnect the open conversation reloads what it may have missed.
    const before = sent("GET", /\/messages$/).length;
    act(() => live!.onConnect(false));
    await waitFor(() => expect(sent("GET", /\/messages$/).length).toBeGreaterThan(before));
  });

  it("stays off for roles without conversations", () => {
    role = "ADMIN";
    renderUi(<LiveMessages />);
    expect(live).toBeNull();
  });
});

function Badge() {
  const badge = useNavBadge("messages");
  return <p>{badge?.label ?? "brak"}</p>;
}

describe("menu counter", () => {
  it("counts conversations with unread messages", async () => {
    unread = 3;
    renderUi(<Badge />);
    expect(await screen.findByText("3 rozmowy z nowymi wiadomościami")).toBeInTheDocument();
  });

  it("shows nothing without unread messages", async () => {
    unread = 0;
    renderUi(<Badge />);
    await waitFor(() => expect(sent("GET", /unread-count$/)).toHaveLength(1));
    expect(screen.getByText("brak")).toBeInTheDocument();
  });
});

describe("NewMessageScreen", () => {
  it("sends the first message from the chosen venue and opens the conversation", async () => {
    venues = [venue(), venue({ id: "v2", name: "Klub Y" })];
    conversations = [];
    const user = userEvent.setup();
    renderUi(<NewMessageScreen recipient={{ artist: "dj-ola" }} />);
    expect(await screen.findByText("Do: DJ Ola")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Piszesz jako" }));
    await user.click(await screen.findByRole("option", { name: "Klub Y" }));
    await user.click(await screen.findByLabelText("Wiadomość"));
    await user.paste("Cześć, zagrasz u nas?");
    await user.click(screen.getByRole("button", { name: "Wyślij" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/messages/${C2}`));
    expect(sent("POST", /\/conversations$/)[0]!.body).toMatchObject({
      venueId: "v2",
      artistSlug: "dj-ola",
      body: "Cześć, zagrasz u nas?",
    });
  });

  it("opens the existing conversation instead", async () => {
    renderUi(<NewMessageScreen recipient={{ artist: "dj-ola" }} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/messages/${C1}`));
    expect(sent("GET", /\/conversations$/)[0]!.search.get("venueId")).toBe("v1");
  });

  it("asks an artist to publish the profile first", async () => {
    role = "ARTIST";
    artistProfile = { id: "p1", published: false, missingForPublication: ["GENRES"] };
    renderUi(<NewMessageScreen recipient={{ venue: "klub-x" }} />);
    expect(await screen.findByText("Pisać może opublikowany profil. Opublikuj swój profil.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przejdź do profilu" })).toHaveAttribute("href", "/profile");
  });

  it("lets an artist write to a venue", async () => {
    role = "ARTIST";
    conversations = [];
    const user = userEvent.setup();
    renderUi(<NewMessageScreen recipient={{ venue: "klub-x" }} />);
    await user.click(await screen.findByLabelText("Wiadomość"));
    await user.paste("Dzień dobry");
    await user.click(screen.getByRole("button", { name: "Wyślij" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(sent("POST", /\/conversations$/)[0]!.body).toMatchObject({ venueSlug: "klub-x", body: "Dzień dobry" });
  });

  it("asks a venue without a published venue to publish it", async () => {
    venues = [venue({ published: false })];
    renderUi(<NewMessageScreen recipient={{ artist: "dj-ola" }} />);
    expect(await screen.findByText("Pisać może opublikowany lokal. Opublikuj swój lokal.")).toBeInTheDocument();
  });
});

describe("MessageCta", () => {
  it("shows venues the button on an artist's profile", () => {
    renderUi(<MessageCta target={{ kind: "artist", slug: "dj-ola" }} />);
    expect(screen.getByRole("link", { name: "Napisz" })).toHaveAttribute("href", "/messages/new?artist=dj-ola");
  });

  it("hides it from artists on another artist's profile", () => {
    role = "ARTIST";
    renderUi(<MessageCta target={{ kind: "artist", slug: "dj-ola" }} />);
    expect(screen.queryByRole("link", { name: "Napisz" })).not.toBeInTheDocument();
  });

  it("leads visitors through the login", () => {
    signedIn = false;
    renderUi(<MessageCta target={{ kind: "venue", slug: "klub-x" }} />);
    expect(screen.getByRole("link", { name: "Napisz" })).toHaveAttribute("href", "/messages/new?venue=klub-x");
  });
});
