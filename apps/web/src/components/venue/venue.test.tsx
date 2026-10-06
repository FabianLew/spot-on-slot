import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import type { Venue } from "@/components/onboarding/profile-requests";
import { Toaster } from "@spot-on-slot/ui";
import { MyProfile } from "@/components/artist/my-profile";
import { findPublicVenue } from "@/lib/public-profiles";
import { InvitationAccept } from "./invitation-accept";
import { VenueEditor } from "./venue-form";
import { VenueProfileView } from "./venue-profile-view";
import { VenueTeam } from "./venue-team";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const me = "u-owner";
const signOut = vi.fn();
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: me, email: "szef@klub.pl", role: "VENUE", locale: "pl" } },
    signOut,
  }),
}));

const photo = (id: string) => ({
  id,
  width: 1600,
  height: 1200,
  small: `https://cdn/${id}-s.webp`,
  medium: `https://cdn/${id}-m.webp`,
  large: `https://cdn/${id}-l.webp`,
});

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "v1",
    slug: "pod-ziemia",
    name: "Pod Ziemią",
    type: "CLUB",
    description: "Piwnica na Kazimierzu.",
    capacity: 300,
    address: { street: "Szewska 5", postalCode: "31-009", city: "Kraków", latitude: 50.06, longitude: 19.93 },
    genres: ["TECHNO"],
    tags: ["ogródek"],
    links: { website: "https://podziemia.pl", instagram: null, facebook: null },
    avatar: photo("av"),
    photos: [photo("p1"), photo("p2")],
    published: false,
    missingForPublication: [],
    role: "OWNER",
    updatedAt: "2026-10-06T10:00:00Z",
    ...overrides,
  } as Venue;
}

type Team = {
  members: { userId: string; email: string | null; role: "OWNER" | "MANAGER"; joinedAt: string }[];
  invitations: { id: string; email: string; role: "OWNER" | "MANAGER"; expiresAt: string }[];
};

let venues: Venue[];
let team: Team;
let saveReply: ((body: Record<string, unknown>) => Response) | undefined;
let acceptStatus: number;
const requests: { method: string; path: string; search: string; body?: unknown }[] = [];

const problem = (status: number, code: string, detail = "x") =>
  Response.json({ type: "about:blank", title: "x", detail, status, code, requestId: "r" }, { status });

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const text = path.startsWith("/api/") && request.method !== "GET" ? await request.text() : "";
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path, search: url.search, body });
  const route = `${request.method} ${path}`;
  const id = /^\/api\/v1\/venues\/(v\d+)/.exec(path)?.[1];
  const current = venues.find((item) => item.id === id);

  if (route === "GET /api/v1/venues/mine") return Response.json(venues);
  if (route === "GET /api/v1/locations/search") {
    return Response.json([
      {
        kind: "HOUSE",
        label: "Długa 12, Kraków",
        street: "Długa 12",
        postalCode: "31-147",
        city: "Kraków",
        latitude: 50.07,
        longitude: 19.94,
      },
    ]);
  }
  if (route === `PUT /api/v1/venues/${id}`) {
    if (saveReply) return saveReply(body);
    const { avatarMediaId, photoMediaIds, address, ...rest } = body;
    const saved = venue({
      ...current,
      ...rest,
      address: address && { latitude: null, longitude: null, ...address },
      avatar: avatarMediaId ? photo(avatarMediaId) : undefined,
      photos: (photoMediaIds as string[]).map(photo),
    });
    venues = venues.map((item) => (item.id === id ? saved : item));
    return Response.json(saved);
  }
  if (route === `DELETE /api/v1/venues/${id}`) {
    venues = venues.filter((item) => item.id !== id);
    return new Response(null, { status: 204 });
  }
  if (route === `POST /api/v1/venues/${id}/publish` || route === `POST /api/v1/venues/${id}/unpublish`) {
    const saved = { ...current!, published: path.endsWith("/publish") };
    venues = venues.map((item) => (item.id === id ? saved : item));
    return Response.json(saved);
  }
  if (path.startsWith("/api/v1/venues/slugs/")) return problem(409, "VENUE_SLUG_TAKEN");
  if (route === `GET /api/v1/venues/${id}/team`) return Response.json(team);
  if (route === `POST /api/v1/venues/${id}/team/invitations`) {
    if (body.email === team.members[0].email) return problem(409, "VENUE_ALREADY_MEMBER", "Już w zespole.");
    const invitation = { id: "i9", email: body.email, role: body.role, expiresAt: "2026-10-13T10:00:00Z" };
    team = { ...team, invitations: [...team.invitations, invitation] };
    return Response.json(invitation, { status: 201 });
  }
  const invitation = /\/team\/invitations\/(\w+)$/.exec(path)?.[1];
  if (request.method === "DELETE" && invitation) {
    team = { ...team, invitations: team.invitations.filter((item) => item.id !== invitation) };
    return new Response(null, { status: 204 });
  }
  const member = /\/team\/([\w-]+)$/.exec(path)?.[1];
  if (request.method === "DELETE" && member) {
    team = { ...team, members: team.members.filter((item) => item.userId !== member) };
    if (member === me) venues = venues.filter((item) => item.id !== id);
    return new Response(null, { status: 204 });
  }
  if (route === "POST /api/v1/venues/invitations/accept") {
    if (acceptStatus !== 200) return problem(acceptStatus, "VENUE_INVITATION_INVALID", "Zaproszenie wygasło.");
    const joined = venue({ id: "v7", name: "Nowa Scena", role: "MANAGER" });
    venues = [...venues, joined];
    return Response.json(joined);
  }
  if (path === "/api/v1/public/venues/pod-ziemia") return Response.json(venue({ published: true }));
  if (path.startsWith("/api/v1/public/venues/")) return problem(404, "VENUE_NOT_FOUND");
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  venues = [venue()];
  team = {
    members: [
      { userId: me, email: "szef@klub.pl", role: "OWNER", joinedAt: "2026-10-01T10:00:00Z" },
      { userId: "u-manager", email: "ola@klub.pl", role: "MANAGER", joinedAt: "2026-10-02T10:00:00Z" },
    ],
    invitations: [{ id: "i1", email: "nowy@klub.pl", role: "MANAGER", expiresAt: "2026-10-10T10:00:00Z" }],
  };
  saveReply = undefined;
  acceptStatus = 200;
  requests.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderWith(node: ReactNode) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {node}
        <Toaster />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const sent = (method: string, path: string) =>
  requests.filter((r) => r.method === method && r.path === path).map((r) => r.body as Record<string, unknown>);

describe("VenueProfileView", () => {
  it("shows the public business data", () => {
    renderWith(<VenueProfileView venue={venue()} />);
    expect(screen.getByRole("heading", { name: "Pod Ziemią", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Klub")).toBeInTheDocument();
    expect(screen.getByText("Szewska 5, 31-009 Kraków")).toBeInTheDocument();
    expect(screen.getByText("Do 300 osób")).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
    expect(screen.getByText("#ogródek")).toBeInTheDocument();
    expect(screen.getByText("Piwnica na Kazimierzu.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Strona www ↗" })).toHaveAttribute("href", "https://podziemia.pl");
    expect(screen.queryByText(/Instagram/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Zdjęcie 2 z 2" })).toHaveAttribute("src", "https://cdn/p2-s.webp");
  });

  it("works without the optional fields", () => {
    renderWith(<VenueProfileView venue={venue({ description: undefined, capacity: undefined, photos: [] })} />);
    expect(screen.getByText(pl.venueProfile.view.noDescription)).toBeInTheDocument();
    expect(screen.queryByText(/osób/)).not.toBeInTheDocument();
    expect(screen.queryByText(pl.venueProfile.view.gallery)).not.toBeInTheDocument();
  });
});

describe("MyProfile for venues", () => {
  it("shows the first venue, its actions, and publishes it", async () => {
    renderWith(<MyProfile />);
    expect(await screen.findByText(pl.venueProfile.mine.draft)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pod Ziemią" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.venueProfile.mine.edit })).toHaveAttribute(
      "href",
      "/profile/venues/v1/edit",
    );
    expect(screen.getByRole("link", { name: pl.venueProfile.mine.team })).toHaveAttribute(
      "href",
      "/profile/venues/v1/team",
    );
    expect(screen.queryByRole("combobox", { name: pl.venueProfile.mine.switch })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: pl.profileStatus.publish }));
    expect(await screen.findByText(pl.venueProfile.mine.published)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.profileStatus.open })).toHaveAttribute("href", "/v/pod-ziemia");
    expect(sent("POST", "/api/v1/venues/v1/publish")).toHaveLength(1);
  });

  it("switches between venues and links to adding one", async () => {
    venues = [venue(), venue({ id: "v2", slug: "druga", name: "Druga Scena" })];
    renderWith(<MyProfile venueId="v2" />);
    expect(await screen.findByRole("heading", { name: "Druga Scena" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.venueProfile.mine.add })).toHaveAttribute(
      "href",
      "/onboarding?new=venue",
    );

    await userEvent.click(screen.getByRole("combobox", { name: pl.venueProfile.mine.switch }));
    await userEvent.click(await screen.findByRole("option", { name: "Pod Ziemią" }));
    expect(router.replace).toHaveBeenCalledWith("/profile?venue=v1");
  });

  it("stops adding venues at the limit", async () => {
    venues = Array.from({ length: 10 }, (_, index) => venue({ id: `v${index + 1}`, name: `Lokal ${index + 1}` }));
    renderWith(<MyProfile />);
    expect(await screen.findByText(pl.venueProfile.mine.limit)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: pl.venueProfile.mine.add })).not.toBeInTheDocument();
  });

  it("lets only owners publish", async () => {
    venues = [venue({ role: "MANAGER" })];
    renderWith(<MyProfile />);
    expect(await screen.findByRole("button", { name: pl.profileStatus.publish })).toBeDisabled();
    expect(screen.getByText(pl.profileStatus.ownerOnly)).toBeInTheDocument();
  });

  it("sends accounts without a venue to the wizard", async () => {
    venues = [];
    renderWith(<MyProfile />);
    expect(await screen.findByText(pl.venueProfile.mine.none)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.venueProfile.mine.add })).toHaveAttribute("href", "/onboarding");
  });
});

describe("VenueEditor", () => {
  async function renderEditor(id = "v1") {
    renderWith(<VenueEditor id={id} />);
    return screen.findByLabelText(pl.venueProfile.edit.name);
  }
  const submit = () => userEvent.click(screen.getByRole("button", { name: pl.artistProfile.edit.save }));

  it("saves the whole venue and keeps the located address", async () => {
    const name = await renderEditor();
    await userEvent.clear(name);
    await userEvent.type(name, "Pod Ziemią Club");
    await userEvent.clear(screen.getByLabelText(pl.venueProfile.edit.capacity));
    await userEvent.type(screen.getByLabelText("Instagram"), "https://instagram.com/podziemia");
    await submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/profile?venue=v1"));
    expect(sent("PUT", "/api/v1/venues/v1")[0]).toEqual({
      name: "Pod Ziemią Club",
      type: "CLUB",
      description: "Piwnica na Kazimierzu.",
      address: { street: "Szewska 5", postalCode: "31-009", city: "Kraków" },
      genres: ["TECHNO"],
      tags: ["ogródek"],
      links: { website: "https://podziemia.pl", instagram: "https://instagram.com/podziemia" },
      avatarMediaId: "av",
      photoMediaIds: ["p1", "p2"],
    });
  });

  it("sends the point of a picked suggestion", async () => {
    await renderEditor();
    await userEvent.type(screen.getByRole("combobox", { name: pl.onboarding.venue.address.search }), "długa");
    await userEvent.click(await screen.findByRole("option", { name: "Długa 12, Kraków" }));
    expect(screen.getByLabelText(pl.onboarding.venue.address.street)).toHaveValue("Długa 12");
    await submit();
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(sent("PUT", "/api/v1/venues/v1")[0].address).toEqual({
      street: "Długa 12",
      postalCode: "31-147",
      city: "Kraków",
      latitude: 50.07,
      longitude: 19.94,
    });
  });

  it("warns about an address off the map", async () => {
    await renderEditor();
    await userEvent.clear(screen.getByLabelText(pl.onboarding.venue.address.street));
    await userEvent.type(screen.getByLabelText(pl.onboarding.venue.address.street), "Nieznana 1");
    await submit();
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(sent("PUT", "/api/v1/venues/v1")[0].address).toEqual({
      street: "Nieznana 1",
      postalCode: "31-009",
      city: "Kraków",
    });
    expect((await screen.findAllByText(pl.venueProfile.edit.savedUnlocated))[0]).toBeInTheDocument();
  });

  it("checks the form and shows backend field errors", async () => {
    saveReply = () =>
      Response.json(
        {
          type: "about:blank",
          title: "Błąd",
          status: 400,
          code: "VALIDATION_FAILED",
          requestId: "r",
          errors: [{ field: "links.facebook", message: "To nie jest link do Facebooka." }],
        },
        { status: 400 },
      );
    await renderEditor();
    await userEvent.type(screen.getByLabelText(pl.venueProfile.edit.capacity), "x");
    await submit();
    expect(await screen.findByText(pl.validation.number)).toBeInTheDocument();
    expect(sent("PUT", "/api/v1/venues/v1")).toEqual([]);

    await userEvent.clear(screen.getByLabelText(pl.venueProfile.edit.capacity));
    await userEvent.type(screen.getByLabelText("Facebook"), "https://example.com/x");
    await submit();
    expect(await screen.findByText("To nie jest link do Facebooka.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("checks a new address against this venue", async () => {
    await renderEditor();
    const slug = screen.getByLabelText(pl.venueProfile.edit.slug);
    await userEvent.clear(slug);
    await userEvent.type(slug, "klub");
    await userEvent.tab();
    expect(await screen.findByText(pl.artistProfile.edit.slugTaken)).toBeInTheDocument();
    expect(requests.find((r) => r.path === "/api/v1/venues/slugs/klub")?.search).toBe("?venueId=v1");
  });

  it("deletes the venue once its name is typed (owners only)", async () => {
    await renderEditor();
    const remove = screen.getByRole("button", { name: pl.venueProfile.edit.delete });
    expect(remove).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Wpisz nazwę lokalu/), "Pod Ziemią");
    await userEvent.click(remove);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/profile"));
    expect(requests.some((r) => r.method === "DELETE" && r.path === "/api/v1/venues/v1")).toBe(true);
  });

  it("hides deleting from managers and explains an unknown venue", async () => {
    venues = [venue({ role: "MANAGER" })];
    await renderEditor();
    expect(screen.queryByRole("button", { name: pl.venueProfile.edit.delete })).not.toBeInTheDocument();
    renderWith(<VenueEditor id="v9" />);
    expect(await screen.findByText(pl.venueProfile.mine.notFound)).toBeInTheDocument();
  });
});

describe("VenueTeam", () => {
  it("lists members and invitations, invites, revokes and removes", async () => {
    renderWith(<VenueTeam id="v1" />);
    const members = await screen.findByRole("list", { name: pl.venueProfile.team.members });
    expect(within(members).getByText("szef@klub.pl")).toBeInTheDocument();
    expect(within(members).getByText(pl.venueProfile.team.you)).toBeInTheDocument();
    expect(within(members).getByText("ola@klub.pl")).toBeInTheDocument();
    expect(screen.getByText("nowy@klub.pl")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(pl.venueProfile.team.email), "dj@klub.pl");
    await userEvent.click(screen.getByRole("button", { name: pl.venueProfile.team.send }));
    expect(await screen.findByText("dj@klub.pl")).toBeInTheDocument();
    expect(sent("POST", "/api/v1/venues/v1/team/invitations")[0]).toEqual({ email: "dj@klub.pl", role: "MANAGER" });

    await userEvent.click(screen.getByRole("button", { name: "Cofnij zaproszenie dla nowy@klub.pl" }));
    await waitFor(() => expect(screen.queryByText("nowy@klub.pl")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Usuń ola@klub.pl z zespołu" }));
    await waitFor(() => expect(screen.queryByText("ola@klub.pl")).not.toBeInTheDocument());
    expect(window.confirm).toHaveBeenCalled();
  });

  it("puts a refused invitation under the form", async () => {
    renderWith(<VenueTeam id="v1" />);
    await userEvent.type(await screen.findByLabelText(pl.venueProfile.team.email), "szef@klub.pl");
    await userEvent.click(screen.getByRole("button", { name: pl.venueProfile.team.send }));
    expect(await screen.findByText("Już w zespole.")).toBeInTheDocument();
  });

  it("keeps the only owner in the team", async () => {
    renderWith(<VenueTeam id="v1" />);
    expect(await screen.findByRole("button", { name: pl.venueProfile.team.leave })).toBeDisabled();
    expect(screen.getByText(pl.venueProfile.team.lastOwner)).toBeInTheDocument();
  });

  it("shows managers the team read-only and lets them leave", async () => {
    venues = [venue({ role: "MANAGER" })];
    team.members[0] = { ...team.members[0], role: "MANAGER" };
    team.members[1] = { ...team.members[1], role: "OWNER" };
    renderWith(<VenueTeam id="v1" />);
    expect(await screen.findByText(pl.venueProfile.team.managerNote)).toBeInTheDocument();
    expect(screen.queryByLabelText(pl.venueProfile.team.email)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cofnij|Usuń/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: pl.venueProfile.team.leave }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/profile"));
    expect(requests.some((r) => r.method === "DELETE" && r.path === `/api/v1/venues/v1/team/${me}`)).toBe(true);
  });
});

describe("InvitationAccept", () => {
  it("joins the team and opens the venue", async () => {
    renderWith(<InvitationAccept token="t0k3n" />);
    expect(screen.getByText(/szef@klub\.pl/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: pl.venueProfile.invitation.accept }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/profile?venue=v7"));
    expect(sent("POST", "/api/v1/venues/invitations/accept")[0]).toEqual({ token: "t0k3n" });
  });

  it("explains an invalid invitation and offers to switch accounts", async () => {
    acceptStatus = 400;
    renderWith(<InvitationAccept token="old" />);
    await userEvent.click(screen.getByRole("button", { name: pl.venueProfile.invitation.accept }));
    expect(await screen.findByText("Zaproszenie wygasło.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: pl.venueProfile.invitation.signOut }));
    expect(signOut).toHaveBeenCalled();
  });

  it("needs a token", () => {
    renderWith(<InvitationAccept token={undefined} />);
    expect(screen.getByText(pl.venueProfile.invitation.missingToken)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pl.venueProfile.invitation.accept })).not.toBeInTheDocument();
  });
});

describe("findPublicVenue", () => {
  it("reads a published venue and treats unknown or malformed addresses as missing", async () => {
    expect((await findPublicVenue("pod-ziemia"))?.name).toBe("Pod Ziemią");
    expect(await findPublicVenue("nic-tu-nie-ma")).toBeNull();
    requests.length = 0;
    expect(await findPublicVenue("Zły Adres")).toBeNull();
    expect(requests).toEqual([]);
  });
});
