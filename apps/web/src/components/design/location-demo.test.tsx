import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { LocationDemo } from "./location-demo";

const krakow = {
  label: "Kraków, małopolskie",
  city: "Kraków",
  region: "małopolskie",
  countryCode: "PL",
  latitude: 50.06,
  longitude: 19.94,
  updatedAt: "2026-10-05T20:00:00Z",
};

let saved: Record<string, unknown> | null;
let saveReply: () => Response;
const puts: unknown[] = [];

const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  if (url.pathname === "/api/v1/locations/me" && request.method === "GET") {
    return saved
      ? Response.json(saved)
      : Response.json({ title: "x", status: 404, code: "LOCATION_NOT_SET", requestId: "r", type: "about:blank" }, { status: 404 });
  }
  if (url.pathname === "/api/v1/locations/me" && request.method === "PUT") {
    puts.push(await request.json());
    return saveReply();
  }
  if (url.pathname === "/api/v1/locations/me" && request.method === "DELETE") {
    saved = null;
    return new Response(null, { status: 204 });
  }
  if (url.pathname === "/api/v1/locations/search") {
    return Response.json([
      { label: "Kraków, małopolskie", city: "Kraków", latitude: 50.0619, longitude: 19.9368 },
      { label: "Krakowska, Kraków", city: "Kraków", latitude: 50.05, longitude: 19.95 },
    ]);
  }
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  saved = null;
  puts.length = 0;
  saveReply = () => Response.json({ ...krakow, source: "MANUAL" });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDemo() {
  render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LocationDemo />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function stubGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"]) {
  vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
}

describe("LocationDemo", () => {
  it("saves a picked suggestion and shows it", async () => {
    renderDemo();
    expect(await screen.findByText(pl.design.location.none)).toBeInTheDocument();

    await userEvent.type(screen.getByRole("combobox"), "krak");
    await userEvent.click(await screen.findByRole("option", { name: "Krakowska, Kraków" }));

    expect(await screen.findByText("Kraków, małopolskie", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("50.06, 19.94 (z dokładnością do około 1 km)")).toBeInTheDocument();
    expect(puts).toEqual([{ latitude: 50.05, longitude: 19.95, source: "MANUAL" }]);
  });

  it("saves the device location", async () => {
    saveReply = () => Response.json({ ...krakow, source: "DEVICE" });
    stubGeolocation((success) =>
      success({ coords: { latitude: 50.061947, longitude: 19.936856 } } as GeolocationPosition),
    );
    renderDemo();
    await screen.findByText(pl.design.location.none);

    await userEvent.click(screen.getByRole("button", { name: pl.design.location.useDevice }));

    expect(await screen.findByText(pl.design.location.sources.DEVICE)).toBeInTheDocument();
    expect(puts).toEqual([{ latitude: 50.061947, longitude: 19.936856, source: "DEVICE" }]);
  });

  it("suggests typing the city when location access is denied", async () => {
    stubGeolocation((_success, failure) =>
      failure?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" } as GeolocationPositionError),
    );
    renderDemo();
    await screen.findByText(pl.design.location.none);

    await userEvent.click(screen.getByRole("button", { name: pl.design.location.useDevice }));

    expect(screen.getByRole("alert")).toHaveTextContent(pl.design.location.denied);
    expect(puts).toEqual([]);
  });

  it("shows the backend message when no town is found, and deletes a saved location", async () => {
    saved = { ...krakow, source: "MANUAL" };
    saveReply = () =>
      Response.json(
        { type: "about:blank", title: "x", status: 422, code: "LOCATION_NOT_FOUND", detail: "Brak miejscowości.", requestId: "r" },
        { status: 422 },
      );
    renderDemo();
    await userEvent.click(await screen.findByRole("button", { name: pl.design.location.delete }));
    expect(await screen.findByText(pl.design.location.none)).toBeInTheDocument();

    await userEvent.type(screen.getByRole("combobox"), "krak");
    await userEvent.click(await screen.findByRole("option", { name: "Kraków, małopolskie" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak miejscowości.");
  });
});
