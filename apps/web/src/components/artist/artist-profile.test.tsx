import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import type { ArtistProfile } from "@/components/onboarding/profile-requests";
import { findPublicArtist } from "@/lib/public-profiles";
import { ArtistProfileView } from "./artist-profile-view";
import { MyProfile } from "./my-profile";
import { ProfileEditor } from "./profile-form";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

let role = "ARTIST";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "u1", email: "dj@example.com", role, locale: "pl" } },
  }),
}));

const photo = (id: string) => ({
  id,
  width: 1600,
  height: 1600,
  small: `https://cdn/${id}-s.webp`,
  medium: `https://cdn/${id}-m.webp`,
  large: `https://cdn/${id}-l.webp`,
});

function artist(overrides: Partial<ArtistProfile> = {}): ArtistProfile {
  return {
    id: "a1",
    slug: "weronika",
    stageName: "Weronika",
    firstName: "Weronika",
    lastName: "Kowalska",
    bio: "Techno z Krakowa.",
    genres: ["TECHNO", "HOUSE"],
    tags: ["vinyl"],
    links: { soundcloud: "https://soundcloud.com/weronika", spotify: null },
    rate: { from: 80000, to: 150000, currency: "PLN" },
    travelRadiusKm: 50,
    skills: { energy: 8, vinyl: null },
    avatar: photo("av"),
    photos: [photo("p1"), photo("p2")],
    location: { label: "Kraków, małopolskie", city: "Kraków" },
    published: false,
    missingForPublication: [],
    updatedAt: "2026-10-06T10:00:00Z",
    ...overrides,
  } as ArtistProfile;
}

let profile: ArtistProfile | null;
let saveReply: (body: Record<string, unknown>) => Response;
let slugStatus: number;
const requests: { method: string; path: string; body?: unknown }[] = [];

const fetchMock = vi.fn(async (request: Request) => {
  const path = new URL(request.url).pathname;
  const text = path.startsWith("/api/") && request.method !== "GET" ? await request.text() : "";
  const body = text ? JSON.parse(text) : undefined;
  requests.push({ method: request.method, path, body });
  const route = `${request.method} ${path}`;
  if (route === "GET /api/v1/artists/me") {
    return profile
      ? Response.json(profile)
      : Response.json({ status: 404, code: "X", title: "x", requestId: "r", type: "about:blank" }, { status: 404 });
  }
  if (route === "PUT /api/v1/artists/me") return saveReply(body);
  if (route === "POST /api/v1/artists/me/publish") return Response.json((profile = { ...profile!, published: true }));
  if (route === "POST /api/v1/artists/me/unpublish")
    return Response.json((profile = { ...profile!, published: false }));
  if (path.startsWith("/api/v1/artists/slugs/")) return new Response(null, { status: slugStatus });
  if (path === "/api/v1/public/artists/weronika") return Response.json(artist({ published: true }));
  if (path.startsWith("/api/v1/public/artists/"))
    return Response.json(
      { status: 404, code: "ARTIST_NOT_FOUND", title: "x", requestId: "r", type: "about:blank" },
      { status: 404 },
    );
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  role = "ARTIST";
  profile = artist();
  slugStatus = 204;
  saveReply = (body) => Response.json({ ...profile, ...body });
  requests.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function renderWith(node: ReactNode) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {node}
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const saved = () =>
  requests
    .filter((r) => r.method === "PUT" && r.path === "/api/v1/artists/me")
    .map((r) => r.body as Record<string, unknown>);

describe("ArtistProfileView", () => {
  it("shows the public fields and never the legal name", () => {
    renderWith(<ArtistProfileView profile={artist()} />);
    expect(screen.getByRole("heading", { name: "Weronika", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Techno")).toBeInTheDocument();
    expect(screen.getByText("#vinyl")).toBeInTheDocument();
    expect(screen.getByText("Dojazd do 50 km")).toBeInTheDocument();
    expect(screen.getByText("800–1500 zł")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: pl.artistProfile.skill.energy })).toHaveAttribute("aria-valuenow", "8");
    expect(screen.queryByRole("meter", { name: pl.artistProfile.skill.vinyl })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SoundCloud ↗" })).toHaveAttribute(
      "href",
      "https://soundcloud.com/weronika",
    );
    expect(screen.queryByText("Spotify ↗")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Zdjęcie 2 z 2" })).toHaveAttribute("src", "https://cdn/p2-s.webp");
    expect(screen.queryByText(/Kowalska/)).not.toBeInTheDocument();
  });

  it("says the fee is on request without a rate", () => {
    renderWith(<ArtistProfileView profile={artist({ rate: undefined, bio: undefined })} />);
    expect(screen.getByText(pl.artistProfile.view.rateOpen)).toBeInTheDocument();
    expect(screen.getByText(pl.artistProfile.view.noBio)).toBeInTheDocument();
  });
});

describe("MyProfile", () => {
  it("lists what is missing and cannot publish a draft that lacks it", async () => {
    profile = artist({ missingForPublication: ["AVATAR"], avatar: undefined });
    renderWith(<MyProfile />);
    expect(await screen.findByText(pl.artistProfile.mine.draft)).toBeInTheDocument();
    expect(screen.getByText(/zdjęcia głównego/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: pl.artistProfile.mine.publish })).toBeDisabled();
    expect(screen.getByRole("link", { name: pl.artistProfile.mine.edit })).toHaveAttribute("href", "/profile/edit");
  });

  it("publishes, then copies the link and unpublishes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWith(<MyProfile />);
    await userEvent.click(await screen.findByRole("button", { name: pl.artistProfile.mine.publish }));
    expect(await screen.findByText(pl.artistProfile.mine.published)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.artistProfile.mine.open })).toHaveAttribute("href", "/a/weronika");

    await userEvent.click(screen.getByRole("button", { name: pl.artistProfile.mine.copyLink }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/a/weronika`);

    await userEvent.click(screen.getByRole("button", { name: pl.artistProfile.mine.unpublish }));
    expect(await screen.findByText(pl.artistProfile.mine.draft)).toBeInTheDocument();
  });

  it("offers the wizard to artists without a profile and explains venues", async () => {
    profile = null;
    renderWith(<MyProfile />);
    expect(await screen.findByRole("link", { name: pl.artistProfile.mine.start })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("tells venues their profile comes later", () => {
    role = "VENUE";
    renderWith(<MyProfile />);
    expect(screen.getByText(pl.artistProfile.mine.venue)).toBeInTheDocument();
  });
});

describe("ProfileEditor", () => {
  async function renderEditor() {
    renderWith(<ProfileEditor />);
    return screen.findByLabelText(pl.artistProfile.edit.stageName);
  }
  const submit = () => userEvent.click(screen.getByRole("button", { name: pl.artistProfile.edit.save }));

  it("saves the whole profile, keeping what was not touched", async () => {
    const stageName = await renderEditor();
    await userEvent.clear(stageName);
    await userEvent.type(stageName, "DJ Weronika");
    await userEvent.type(screen.getByLabelText(pl.artistProfile.edit.tags), "open air{Enter}");
    fireEvent.change(screen.getByRole("slider", { name: pl.artistProfile.skill.tempo }), { target: { value: "6" } });
    await userEvent.clear(screen.getByLabelText(pl.artistProfile.edit.rateTo));
    await submit();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/profile"));
    expect(saved()[0]).toEqual({
      stageName: "DJ Weronika",
      firstName: "Weronika",
      lastName: "Kowalska",
      bio: "Techno z Krakowa.",
      genres: ["TECHNO", "HOUSE"],
      tags: ["vinyl", "open air"],
      links: { soundcloud: "https://soundcloud.com/weronika" },
      rateFrom: 80000,
      travelRadiusKm: 50,
      skills: { energy: 8, tempo: 6 },
      avatarMediaId: "av",
      photoMediaIds: ["p1", "p2"],
    });
  });

  it("reorders and removes gallery photos", async () => {
    await renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Przesuń zdjęcie 1 dalej" }));
    await submit();
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0].photoMediaIds).toEqual(["p2", "p1"]);
  });

  it("checks the form before saving", async () => {
    await renderEditor();
    await userEvent.clear(screen.getByLabelText(pl.artistProfile.edit.rateFrom));
    await userEvent.type(screen.getByLabelText(pl.artistProfile.edit.rateFrom), "2000");
    await userEvent.type(screen.getByLabelText("Instagram"), "instagram.com/weronika");
    await submit();
    expect(await screen.findByText(pl.validation.rateOrder)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.https)).toBeInTheDocument();
    expect(saved()).toEqual([]);
  });

  it("puts backend field errors under the field", async () => {
    saveReply = () =>
      Response.json(
        {
          type: "about:blank",
          title: "Błąd",
          status: 400,
          code: "VALIDATION_FAILED",
          requestId: "r",
          errors: [{ field: "links.instagram", message: "To nie jest link do Instagrama." }],
        },
        { status: 400 },
      );
    await renderEditor();
    await userEvent.type(screen.getByLabelText("Instagram"), "https://example.com/x");
    await submit();
    expect(await screen.findByText("To nie jest link do Instagrama.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("checks a new address when leaving the field", async () => {
    slugStatus = 409;
    await renderEditor();
    const slug = screen.getByLabelText(pl.artistProfile.edit.slug);
    await userEvent.clear(slug);
    await userEvent.type(slug, "Dj-Wera");
    await userEvent.tab();
    expect(await screen.findByText(pl.artistProfile.edit.slugTaken)).toBeInTheDocument();
    expect(requests.some((r) => r.path === "/api/v1/artists/slugs/dj-wera")).toBe(true);
  });
});

describe("findPublicArtist", () => {
  it("reads a published profile and treats unknown or malformed addresses as missing", async () => {
    expect((await findPublicArtist("weronika"))?.stageName).toBe("Weronika");
    expect(await findPublicArtist("nikt-taki")).toBeNull();
    requests.length = 0;
    expect(await findPublicArtist("Zły Adres")).toBeNull();
    expect(requests).toEqual([]);
  });
});
