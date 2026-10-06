import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { ArtistWizard, firstArtistStep } from "./artist-wizard";
import { OnboardingGate } from "./onboarding-gate";
import { OnboardingScreen } from "./onboarding-screen";
import { ProfileReminder } from "./profile-reminder";
import type { ArtistProfile, Venue } from "./profile-requests";
import { isOnboardingSkipped, skipOnboarding } from "./skip";
import { SummaryBody } from "./summary-step";
import { firstVenueStep, VenueWizard } from "./venue-wizard";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

let role = "ARTIST";
const userId = "0190-user";
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: {
      status: "authenticated",
      user: { id: userId, email: "dj@example.com", role, locale: "pl" },
    },
  }),
}));

const image = {
  id: "m1",
  width: 1600,
  height: 1200,
  small: "https://cdn/s.webp",
  medium: "https://cdn/m.webp",
  large: "https://cdn/l.webp",
};

function artist(overrides: Partial<ArtistProfile> = {}): ArtistProfile {
  const profile: ArtistProfile = {
    id: "a1",
    slug: "weronika",
    stageName: "Weronika",
    genres: ["TECHNO"],
    tags: [],
    links: {},
    travelRadiusKm: 50,
    skills: {},
    photos: [],
    published: false,
    missingForPublication: [],
    updatedAt: "2026-10-06T08:00:00Z",
    ...overrides,
  } as ArtistProfile;
  return {
    ...profile,
    missingForPublication: overrides.missingForPublication ?? artistMissing(profile),
  };
}

function artistMissing(profile: ArtistProfile): ArtistProfile["missingForPublication"] {
  const missing: ArtistProfile["missingForPublication"] = [];
  if (!profile.stageName) missing.push("STAGE_NAME");
  if (profile.genres.length === 0) missing.push("GENRE");
  if (!profile.avatar) missing.push("AVATAR");
  if (!profile.location) missing.push("LOCATION");
  return missing;
}

function venue(overrides: Partial<Venue> = {}): Venue {
  const value = {
    id: "v1",
    slug: "pod-ziemia",
    name: "Pod Ziemią",
    type: "CLUB",
    genres: [],
    tags: [],
    links: {},
    photos: [],
    published: false,
    role: "OWNER",
    updatedAt: "2026-10-06T08:00:00Z",
    ...overrides,
  } as Venue;
  return { ...value, missingForPublication: venueMissing(value) };
}

function venueMissing(value: Venue): Venue["missingForPublication"] {
  const missing: Venue["missingForPublication"] = [];
  if (value.address?.latitude == null) missing.push("ADDRESS");
  if (value.genres.length === 0) missing.push("GENRE");
  if (!value.avatar) missing.push("AVATAR");
  return missing;
}

const notFound = () =>
  Response.json(
    {
      type: "about:blank",
      title: "x",
      status: 404,
      code: "ARTIST_PROFILE_NOT_FOUND",
      requestId: "r",
    },
    { status: 404 },
  );

// A small fake of the backend: the wizards' requests change this state like the real endpoints would.
let artistProfile: ArtistProfile | null;
let venues: Venue[];
let geocodes: boolean;
const requests: { method: string; path: string; body?: unknown }[] = [];

const places = [
  {
    kind: "HOUSE",
    label: "Szewska 5, Kraków",
    street: "Szewska 5",
    postalCode: "31-009",
    city: "Kraków",
    latitude: 50.0624,
    longitude: 19.9353,
  },
  {
    kind: "CITY",
    label: "Kraków, małopolskie",
    city: "Kraków",
    latitude: 50.0619,
    longitude: 19.9368,
  },
];

const fetchMock = vi.fn(async (request: Request) => {
  const path = new URL(request.url).pathname;
  const body =
    path.startsWith("/api/") && ["PUT", "POST"].includes(request.method)
      ? await request.text().then((t) => (t ? JSON.parse(t) : undefined))
      : undefined;
  requests.push({ method: request.method, path, body });
  const route = `${request.method} ${path}`;

  if (route === "GET /api/v1/artists/me") return artistProfile ? Response.json(artistProfile) : notFound();
  if (route === "PUT /api/v1/artists/me") {
    // Request-only fields (photo ids, rates) are not used by the wizard, so the fake keeps just the rest.
    const { avatarMediaId, stageName, genres, bio, tags } = body as Record<string, unknown>;
    artistProfile = artist({
      ...artistProfile,
      ...({ stageName, genres, bio, tags } as Partial<ArtistProfile>),
      avatar: avatarMediaId ? { ...image, id: avatarMediaId as string } : undefined,
      missingForPublication: undefined,
    });
    return Response.json(artistProfile);
  }
  if (route === "POST /api/v1/artists/me/publish") {
    artistProfile = { ...artistProfile!, published: true };
    return Response.json(artistProfile);
  }
  if (route === "PUT /api/v1/locations/me") {
    artistProfile = artist({
      ...artistProfile!,
      location: { label: "Kraków, małopolskie", city: "Kraków" },
      missingForPublication: undefined,
    });
    return Response.json({
      label: "Kraków, małopolskie",
      city: "Kraków",
      latitude: 50.06,
      longitude: 19.94,
      source: "MANUAL",
      updatedAt: "x",
    });
  }
  if (route === "GET /api/v1/locations/search") return Response.json(places);
  if (route === "GET /api/v1/venues/mine") return Response.json(venues);
  if (route === "POST /api/v1/venues" || route === "PUT /api/v1/venues/v1") {
    const { avatarMediaId, address, ...rest } = body as Record<string, unknown> & { address?: Venue["address"] };
    const located =
      address && address.latitude === undefined && geocodes
        ? { ...address, latitude: 50.06, longitude: 19.93 }
        : // Like the real backend, a missing point comes back as null.
          address && ({ latitude: null, longitude: null, ...address } as unknown as Venue["address"]);
    const saved = venue({
      ...venues[0],
      ...(rest as Partial<Venue>),
      address: located,
      avatar: avatarMediaId ? { ...image, id: avatarMediaId as string } : undefined,
    });
    venues = [saved];
    return Response.json(saved, {
      status: request.method === "POST" ? 201 : 200,
    });
  }
  if (route === "POST /api/v1/venues/v1/publish") {
    venues = [{ ...venues[0], published: true }];
    return Response.json(venues[0]);
  }
  if (route === "POST /api/v1/media/uploads") {
    return Response.json({
      uploadId: "u1",
      url: "https://storage/u1",
      method: "PUT",
      headers: {},
      expiresAt: "x",
    });
  }
  if (route === "PUT /u1") return new Response(null, { status: 200 });
  if (route === "POST /api/v1/media/uploads/u1/complete") {
    return Response.json({
      id: "m1",
      width: 1600,
      height: 1200,
      variants: { small: "s", medium: "m", large: "l" },
    });
  }
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  role = "ARTIST";
  artistProfile = null;
  venues = [];
  geocodes = true;
  requests.length = 0;
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWith(node: ReactNode) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {node}
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const saves = (path: string) => requests.filter((r) => r.path === path && (r.method === "PUT" || r.method === "POST"));
const currentStep = () => document.querySelector('[aria-current="step"]')?.textContent;

describe("first missing step", () => {
  it("starts new profiles at the beginning and resumes at what is missing", () => {
    expect(firstArtistStep(null)).toBe(0);
    expect(firstArtistStep(artist({ genres: [] }))).toBe(0);
    expect(firstArtistStep(artist())).toBe(1);
    expect(firstArtistStep(artist({ avatar: image }))).toBe(2);
    expect(
      firstArtistStep(
        artist({
          avatar: image,
          location: { label: "Kraków", city: "Kraków" },
        }),
      ),
    ).toBe(3);

    expect(firstVenueStep(null)).toBe(0);
    expect(firstVenueStep(venue())).toBe(1);
    expect(
      firstVenueStep(
        venue({
          address: {
            street: "Szewska 5",
            city: "Kraków",
            latitude: 1,
            longitude: 2,
          },
        }),
      ),
    ).toBe(2);
  });
});

describe("ArtistWizard", () => {
  it("checks the first step, then saves the stage name and genres", async () => {
    renderWith(<ArtistWizard />);
    await userEvent.click(await screen.findByRole("button", { name: pl.onboarding.next }));

    expect(await screen.findByText(pl.validation.required)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.genresRequired)).toBeInTheDocument();
    expect(saves("/api/v1/artists/me")).toEqual([]);

    await userEvent.type(screen.getByLabelText(pl.onboarding.artist.basics.stageName), "DJ Weronika");
    await userEvent.click(screen.getByRole("button", { name: pl.genres.TECHNO }));
    await userEvent.click(screen.getByRole("button", { name: pl.genres.HOUSE }));
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));

    expect(
      await screen.findByRole("heading", {
        name: pl.onboarding.artist.photo.title,
      }),
    ).toBeInTheDocument();
    expect(saves("/api/v1/artists/me")[0].body).toEqual({
      stageName: "DJ Weronika",
      genres: ["TECHNO", "HOUSE"],
    });
  });

  it("needs a photo and keeps the rest of the profile when saving it", async () => {
    artistProfile = artist({ bio: "Techno z Krakowa", tags: ["vinyl"] });
    renderWith(<ArtistWizard />);
    await userEvent.click(await screen.findByRole("button", { name: pl.onboarding.next }));
    expect(screen.getByRole("alert")).toHaveTextContent(pl.onboarding.photo.required);

    const file = new File(["x"], "me.jpg", { type: "image/jpeg" });
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    await waitFor(() => expect(saves("/api/v1/artists/me")).toHaveLength(1));
    expect(saves("/api/v1/artists/me")[0].body).toMatchObject({
      stageName: "Weronika",
      bio: "Techno z Krakowa",
      tags: ["vinyl"],
      genres: ["TECHNO"],
      avatarMediaId: "m1",
    });

    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));
    expect(
      await screen.findByRole("heading", {
        name: pl.onboarding.artist.location.title,
      }),
    ).toBeInTheDocument();
  });

  it("resumes at the location, then publishes", async () => {
    artistProfile = artist({ avatar: image });
    renderWith(<ArtistWizard />);
    expect(
      await screen.findByRole("heading", {
        name: pl.onboarding.artist.location.title,
      }),
    ).toBeInTheDocument();
    expect(currentStep()).toBe(pl.onboarding.artist.steps.location);

    await userEvent.type(screen.getByRole("combobox"), "krak");
    await userEvent.click(await screen.findByRole("option", { name: "Kraków, małopolskie" }));
    expect(await screen.findByText("Twoja lokalizacja: Kraków, małopolskie")).toBeInTheDocument();
    expect(saves("/api/v1/locations/me")[0].body).toEqual({
      latitude: 50.0619,
      longitude: 19.9368,
      source: "MANUAL",
    });

    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));
    expect(await screen.findByText(pl.onboarding.summary.ready)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.summary.publish }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
    expect(saves("/api/v1/artists/me/publish")).toHaveLength(1);
  });

  it("lets a finished artist keep a draft", async () => {
    artistProfile = artist({
      avatar: image,
      location: { label: "Kraków", city: "Kraków" },
    });
    renderWith(<ArtistWizard />);
    expect(await screen.findByText(pl.onboarding.summary.ready)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.summary.draft }));
    expect(router.push).toHaveBeenCalledWith("/dashboard");
    expect(saves("/api/v1/artists/me/publish")).toEqual([]);
  });
});

describe("SummaryBody", () => {
  it("lists what is still missing", () => {
    renderWith(<SummaryBody missing={["GENRE", "AVATAR"]} />);
    expect(screen.getByText(pl.onboarding.summary.missingTitle)).toBeInTheDocument();
    expect(screen.getByText(pl.onboarding.missing.GENRE)).toBeInTheDocument();
    expect(screen.getByText(pl.onboarding.missing.AVATAR)).toBeInTheDocument();
  });
});

describe("VenueWizard", () => {
  async function pickType(name: string) {
    await userEvent.click(screen.getByRole("combobox", { name: pl.onboarding.venue.basics.type }));
    await userEvent.click(await screen.findByRole("option", { name }));
  }

  it("creates the venue, then fills the address from a suggestion", async () => {
    role = "VENUE";
    renderWith(<VenueWizard />);
    await userEvent.type(await screen.findByLabelText(pl.onboarding.venue.basics.name), "Pod Ziemią");
    await pickType(pl.venueTypes.BAR);
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));

    expect(
      await screen.findByRole("heading", {
        name: pl.onboarding.venue.address.title,
      }),
    ).toBeInTheDocument();
    expect(saves("/api/v1/venues")[0]).toMatchObject({
      method: "POST",
      body: { name: "Pod Ziemią", type: "BAR" },
    });

    await userEvent.type(screen.getByRole("combobox"), "szewska");
    await userEvent.click(await screen.findByRole("option", { name: "Szewska 5, Kraków" }));
    expect(screen.getByLabelText(pl.onboarding.venue.address.street)).toHaveValue("Szewska 5");
    expect(screen.getByLabelText(pl.onboarding.venue.address.postalCode)).toHaveValue("31-009");
    expect(screen.getByLabelText(pl.onboarding.venue.address.city)).toHaveValue("Kraków");
    expect(screen.getByText(pl.onboarding.venue.address.located)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));
    expect(
      await screen.findByRole("heading", {
        name: pl.onboarding.venue.music.title,
      }),
    ).toBeInTheDocument();
    expect(saves("/api/v1/venues/v1")[0].body).toMatchObject({
      name: "Pod Ziemią",
      type: "BAR",
      address: {
        street: "Szewska 5",
        postalCode: "31-009",
        city: "Kraków",
        latitude: 50.0624,
        longitude: 19.9353,
      },
    });
  });

  it("warns when a typed address is not on the map and continues on a second click", async () => {
    role = "VENUE";
    geocodes = false;
    venues = [venue()];
    renderWith(<VenueWizard />);
    await userEvent.type(await screen.findByLabelText(pl.onboarding.venue.address.street), "Nieznana 1");
    await userEvent.type(screen.getByLabelText(pl.onboarding.venue.address.city), "Kraków");
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));

    expect(await screen.findByRole("alert")).toHaveTextContent(pl.onboarding.venue.address.notLocated);
    expect(saves("/api/v1/venues/v1")[0].body).toMatchObject({
      address: { street: "Nieznana 1", city: "Kraków" },
    });
    expect((saves("/api/v1/venues/v1")[0].body as Venue).address).not.toHaveProperty("latitude");

    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));
    expect(
      await screen.findByRole("heading", {
        name: pl.onboarding.venue.music.title,
      }),
    ).toBeInTheDocument();
    expect(saves("/api/v1/venues/v1")).toHaveLength(1);
  });

  it("needs genres and a photo, then the owner publishes", async () => {
    role = "VENUE";
    venues = [
      venue({
        address: {
          street: "Szewska 5",
          city: "Kraków",
          latitude: 50.06,
          longitude: 19.93,
        },
      }),
    ];
    renderWith(<VenueWizard />);
    await userEvent.click(await screen.findByRole("button", { name: pl.onboarding.next }));
    expect(screen.getByText(pl.validation.genresRequired)).toBeInTheDocument();
    expect(screen.getByText(pl.onboarding.photo.required)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: pl.genres.DISCO }));
    const file = new File(["x"], "club.png", { type: "image/png" });
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    await waitFor(() => expect(saves("/api/v1/venues/v1")).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.next }));

    expect(await screen.findByText(pl.onboarding.summary.ready)).toBeInTheDocument();
    expect(saves("/api/v1/venues/v1")[1].body).toMatchObject({
      genres: ["DISCO"],
      avatarMediaId: "m1",
    });
    await userEvent.click(screen.getByRole("button", { name: pl.onboarding.summary.publish }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
    expect(saves("/api/v1/venues/v1/publish")).toHaveLength(1);
  });
});

describe("OnboardingGate", () => {
  const app = (
    <OnboardingGate>
      <p>pulpit</p>
    </OnboardingGate>
  );

  it("sends an artist without a profile to the wizard", async () => {
    renderWith(app);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
    expect(screen.queryByText("pulpit")).not.toBeInTheDocument();
  });

  it("sends a venue account without venues to the wizard", async () => {
    role = "VENUE";
    renderWith(app);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("lets people in who have a profile, skipped the wizard or have no profile role", async () => {
    artistProfile = artist();
    renderWith(app);
    expect(await screen.findByText("pulpit")).toBeInTheDocument();
  });

  it("respects the skip", async () => {
    skipOnboarding(userId);
    renderWith(app);
    expect(await screen.findByText("pulpit")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not ask bookers", async () => {
    role = "BOOKER";
    renderWith(app);
    expect(await screen.findByText("pulpit")).toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});

describe("OnboardingScreen and ProfileReminder", () => {
  it("remembers the skip and goes to the dashboard", async () => {
    renderWith(<OnboardingScreen />);
    await userEvent.click(await screen.findByRole("button", { name: pl.onboarding.skip }));
    expect(isOnboardingSkipped(userId)).toBe(true);
    expect(router.push).toHaveBeenCalledWith("/dashboard");
  });

  it("explains that other roles have nothing to fill in", () => {
    role = "BOOKER";
    renderWith(<OnboardingScreen />);
    expect(screen.getByText(pl.onboarding.otherRole.title)).toBeInTheDocument();
  });

  it("counts what is missing on the dashboard", async () => {
    artistProfile = artist();
    renderWith(<ProfileReminder />);
    expect(await screen.findByText("Do publikacji brakują jeszcze 2 rzeczy.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.onboarding.reminder.action })).toHaveAttribute("href", "/onboarding");
  });

  it("disappears once the profile is published", async () => {
    artistProfile = {
      ...artist({
        avatar: image,
        location: { label: "Kraków", city: "Kraków" },
      }),
      published: true,
    };
    renderWith(<ProfileReminder />);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByText(pl.onboarding.reminder.title)).not.toBeInTheDocument();
  });
});
