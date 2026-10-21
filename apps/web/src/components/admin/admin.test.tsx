import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { ReportDialog } from "@/components/moderation/report-dialog";
import { AdminGate, AdminRedirect } from "./admin-gate";
import type { AdminUser, ReportTargetDetail, ReportTargetSummary } from "./queries";
import { ReportTargetScreen } from "./report-target-screen";
import { ReportsScreen } from "./reports-screen";
import { UsersScreen } from "./users-screen";

let role = "ADMIN";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "admin-1", email: "admin@example.com", role, locale: "pl" } },
  }),
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => "/a/dj-ola" }));

const NOW = new Date("2026-10-15T10:00:00Z");

const summary = (overrides: Partial<ReportTargetSummary> = {}): ReportTargetSummary => ({
  kind: "VENUE",
  targetId: "v1",
  label: "Pod Ziemią",
  openCount: 2,
  firstReportedAt: "2026-10-14T08:00:00Z",
  lastReportedAt: "2026-10-15T08:00:00Z",
  reasons: ["FRAUD", "SPAM"],
  ...overrides,
});

const account = { id: "u1", email: "dj@example.com", role: "ARTIST" as const, state: "ACTIVE" as const, createdAt: "2026-10-01T10:00:00Z" };

const detail = (overrides: Partial<ReportTargetDetail> = {}): ReportTargetDetail => ({
  kind: "ARTIST",
  targetId: "p1",
  label: "DJ Ola",
  artist: { profileId: "p1", ownerId: "u1", slug: "dj-ola", stageName: "DJ Ola", published: true },
  owners: [account],
  reports: [
    {
      id: "r2",
      reporterId: "u2",
      reporterEmail: "klub@example.com",
      reason: "OTHER",
      description: "Nie przyszedł na występ",
      status: "OPEN",
      createdAt: "2026-10-15T08:00:00Z",
    },
    { id: "r1", reason: "SPAM", status: "OPEN", createdAt: "2026-10-14T08:00:00Z" },
  ],
  actions: [],
  ...overrides,
});

let queue: ReportTargetSummary[];
let target: ReportTargetDetail | null;
let users: AdminUser[];
let reportProblem: object | null;
const posts: { path: string; body: unknown }[] = [];
const gets: URL[] = [];

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "POST") {
    const body = await request.clone().json();
    posts.push({ path, body });
    if (path === "/api/v1/reports") {
      return reportProblem
        ? Response.json(reportProblem, { status: (reportProblem as { status: number }).status })
        : Response.json({ id: "r9", createdAt: NOW.toISOString() }, { status: 201 });
    }
    if (path.endsWith("/hide")) return Response.json({ ...target!.artist, published: false, hiddenAt: NOW.toISOString(), hiddenReason: body.reason });
    if (path.endsWith("/dismiss")) return Response.json(target);
    if (path.endsWith("/block")) return Response.json({ account: { ...account, state: "BLOCKED" }, venues: [], reportsTotal: 1, reportsOpen: 0 });
    return new Response(null, { status: 404 });
  }
  gets.push(url);
  const page = (content: unknown[]) => Response.json({ content, page: 0, size: 20, totalElements: content.length });
  if (path === "/api/v1/admin/reports") return page(queue);
  if (path.startsWith("/api/v1/admin/reports/")) {
    return target ? Response.json(target) : Response.json({ code: "MODERATION_TARGET_NOT_FOUND" }, { status: 404 });
  }
  if (path === "/api/v1/admin/users") return page(users);
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  role = "ADMIN";
  queue = [summary(), summary({ kind: "ARTIST", targetId: "p1", label: "DJ Ola", openCount: 1, reasons: ["OFFENSIVE"] })];
  target = detail();
  users = [
    {
      account: { ...account, lastSignInAt: "2026-10-14T20:00:00Z" },
      artist: { profileId: "p1", ownerId: "u1", slug: "dj-ola", stageName: "DJ Ola", published: true },
      venues: [],
      reportsTotal: 3,
      reportsOpen: 2,
    },
  ];
  reportProblem = null;
  posts.length = 0;
  gets.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderUi(ui: ReactNode) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw" now={NOW}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {ui}
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("report queue", () => {
  it("lists reported things with their open count and reasons, linking to the detail", async () => {
    renderUi(<ReportsScreen />);
    const list = await screen.findByRole("list", { name: "Kolejka zgłoszeń" });
    const items = within(list).getAllByRole("link");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("href", "/admin/reports/VENUE/v1");
    expect(items[0]).toHaveTextContent("Pod Ziemią");
    expect(items[0]).toHaveTextContent("2 zgłoszenia");
    expect(items[0]).toHaveTextContent("Oszustwo");
    expect(items[0]).toHaveTextContent("Spam");
    expect(items[1]).toHaveTextContent("1 zgłoszenie");
  });

  it("filters by kind through the address", async () => {
    const user = userEvent.setup();
    renderUi(<ReportsScreen kind="LISTING" />);
    await screen.findByRole("list", { name: "Kolejka zgłoszeń" });
    expect(gets.find((url) => url.pathname === "/api/v1/admin/reports")?.searchParams.get("kind")).toBe("LISTING");
    expect(screen.getByRole("button", { name: "Ogłoszenie" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Rozmowa" }));
    expect(replace).toHaveBeenCalledWith("/admin/reports?kind=CONVERSATION", { scroll: false });
  });

  it("says when nothing waits", async () => {
    queue = [];
    renderUi(<ReportsScreen />);
    expect(await screen.findByText("Brak otwartych zgłoszeń.")).toBeInTheDocument();
  });
});

describe("reported thing", () => {
  it("shows the profile, its owner and every report", async () => {
    renderUi(<ReportTargetScreen kind="ARTIST" targetId="p1" />);
    expect(await screen.findByRole("heading", { name: "DJ Ola", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Otwarte: 2 · wszystkie: 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dj@example.com" })).toHaveAttribute("href", "/admin/users/u1");
    expect(screen.getByText("Nie przyszedł na występ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "klub@example.com" })).toHaveAttribute("href", "/admin/users/u2");
    expect(screen.getByText("Zgłaszający: Usunięte konto")).toBeInTheDocument();
  });

  it("hides the profile only with a reason", async () => {
    const user = userEvent.setup();
    renderUi(<ReportTargetScreen kind="ARTIST" targetId="p1" />);
    await user.click(await screen.findByRole("button", { name: "Ukryj" }));
    const dialog = await screen.findByRole("dialog", { name: "Ukryć „DJ Ola”?" });
    await user.click(within(dialog).getByRole("button", { name: "Ukryj" }));
    expect(await within(dialog).findByText("To pole jest wymagane.")).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    await user.type(within(dialog).getByRole("textbox", { name: "Powód" }), "Obraźliwe zdjęcia");
    await user.click(within(dialog).getByRole("button", { name: "Ukryj" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posts).toEqual([{ path: "/api/v1/admin/artists/p1/hide", body: { reason: "Obraźliwe zdjęcia" } }]);
  });

  it("dismisses the open reports with a note and blocks an owner", async () => {
    const user = userEvent.setup();
    renderUi(<ReportTargetScreen kind="ARTIST" targetId="p1" />);
    await user.click(await screen.findByRole("button", { name: "Odrzuć zgłoszenia" }));
    let dialog = await screen.findByRole("dialog", { name: "Odrzucić zgłoszenia?" });
    expect(dialog).toHaveTextContent("Zamkniesz 2 otwarte zgłoszenia");
    await user.type(within(dialog).getByRole("textbox", { name: "Powód" }), "Brak naruszenia");
    await user.click(within(dialog).getByRole("button", { name: "Odrzuć" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ path: "/api/v1/admin/reports/ARTIST/p1/dismiss", body: { reason: "Brak naruszenia" } });

    await user.click(screen.getByRole("button", { name: "Zablokuj" }));
    dialog = await screen.findByRole("dialog", { name: "Zablokować dj@example.com?" });
    await user.type(within(dialog).getByRole("textbox", { name: "Powód" }), "Oszustwa");
    await user.click(within(dialog).getByRole("button", { name: "Zablokuj" }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toEqual({ path: "/api/v1/admin/users/u1/block", body: { reason: "Oszustwa" } });
  });

  it("shows the copy of a reported conversation", async () => {
    target = detail({
      kind: "CONVERSATION",
      targetId: "c1",
      label: "Pod Ziemią",
      artist: undefined,
      reports: [
        {
          id: "r1",
          reporterId: "u1",
          reporterEmail: "dj@example.com",
          reason: "OFFENSIVE",
          status: "OPEN",
          createdAt: "2026-10-15T08:00:00Z",
          messages: [
            { side: "ARTIST", reporter: true, body: "Dzień dobry", deleted: false, createdAt: "2026-10-15T07:00:00Z" },
            { side: "VENUE", reporter: false, body: "Spadaj", deleted: false, createdAt: "2026-10-15T07:05:00Z" },
          ],
        },
      ],
    });
    renderUi(<ReportTargetScreen kind="CONVERSATION" targetId="c1" />);
    expect(await screen.findByText("Kopia rozmowy (2 wiadomości)")).toBeInTheDocument();
    expect(screen.getByText("Spadaj")).toBeInTheDocument();
    expect(screen.getByText(/Druga strona/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ukryj" })).not.toBeInTheDocument();
  });

  it("says when nothing was reported under the id", async () => {
    target = null;
    renderUi(<ReportTargetScreen kind="VENUE" targetId="x" />);
    expect(await screen.findByText("Nie ma zgłoszeń o takim identyfikatorze.")).toBeInTheDocument();
  });
});

describe("users", () => {
  it("lists accounts with what they run and their open reports", async () => {
    renderUi(<UsersScreen filter={{}} />);
    const list = await screen.findByRole("list", { name: "Konta" });
    const row = within(list).getByRole("link");
    expect(row).toHaveAttribute("href", "/admin/users/u1");
    expect(row).toHaveTextContent("dj@example.com");
    expect(row).toHaveTextContent("DJ Ola");
    expect(row).toHaveTextContent("2 otwarte zgłoszenia");
    expect(screen.getByRole("status")).toHaveTextContent("Znaleziono 1 konto");
  });

  it("keeps the search in the address", async () => {
    const user = userEvent.setup();
    renderUi(<UsersScreen filter={{ state: "BLOCKED" }} />);
    await screen.findByRole("list", { name: "Konta" });
    expect(gets.find((url) => url.pathname === "/api/v1/admin/users")?.searchParams.get("state")).toBe("BLOCKED");
    await user.type(screen.getByRole("searchbox", { name: "Szukaj" }), "pod ziemią");
    await user.click(screen.getByRole("button", { name: "Szukaj" }));
    expect(replace).toHaveBeenCalledWith("/admin/users?q=pod+ziemi%C4%85&state=BLOCKED", { scroll: false });
  });
});

describe("report form", () => {
  it("needs a reason and, for Other, a description, then only thanks", async () => {
    const user = userEvent.setup();
    renderUi(<ReportDialog target={{ kind: "ARTIST", slug: "dj-ola" }} open onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Zgłoś profil" });
    await user.click(within(dialog).getByRole("button", { name: "Wyślij zgłoszenie" }));
    expect(await within(dialog).findByText("Wybierz powód.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("radio", { name: /Inne/ }));
    await user.click(within(dialog).getByRole("button", { name: "Wyślij zgłoszenie" }));
    expect(await within(dialog).findByText("Przy powodzie „Inne” opisz problem.")).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    await user.type(within(dialog).getByRole("textbox", { name: "Opis (wymagany)" }), "Podaje cudze nagrania");
    await user.click(within(dialog).getByRole("button", { name: "Wyślij zgłoszenie" }));
    expect(await screen.findByText("Dziękujemy, sprawdzimy to.")).toBeInTheDocument();
    expect(posts).toEqual([
      {
        path: "/api/v1/reports",
        body: { kind: "ARTIST", slug: "dj-ola", reason: "OTHER", description: "Podaje cudze nagrania" },
      },
    ]);
  });

  it("shows why the backend refused", async () => {
    reportProblem = {
      title: "Już to zgłoszono",
      detail: "Twoje zgłoszenie czeka na sprawdzenie.",
      status: 409,
      code: "MODERATION_ALREADY_REPORTED",
      requestId: "r",
    };
    const user = userEvent.setup();
    renderUi(<ReportDialog target={{ kind: "LISTING", id: "l1" }} open onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Zgłoś ogłoszenie" });
    await user.click(within(dialog).getByRole("radio", { name: /Spam/ }));
    await user.click(within(dialog).getByRole("button", { name: "Wyślij zgłoszenie" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Twoje zgłoszenie czeka na sprawdzenie.");
  });
});

describe("gates", () => {
  it("sends admins from the app to the panel and others from the panel to the app", async () => {
    renderUi(
      <AdminRedirect>
        <p>Pulpit</p>
      </AdminRedirect>,
    );
    expect(screen.queryByText("Pulpit")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/reports"));

    role = "VENUE";
    replace.mockClear();
    renderUi(
      <AdminGate>
        <p>Panel</p>
      </AdminGate>,
    );
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});
