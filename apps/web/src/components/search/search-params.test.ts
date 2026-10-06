import { describe, expect, it } from "vitest";
import { artistQuery, defaultTab, listingQuery, parseSearch, searchHref, venueQuery } from "./search-params";

const center = { lat: 50.06, lng: 19.94 };
const parse = (query: string) => parseSearch(new URLSearchParams(query), "artists");

describe("parseSearch", () => {
  it("reads every filter and ignores what does not fit", () => {
    const state = parse(
      "tab=venues&lat=50.06&lng=19.94&place=Krak%C3%B3w&radius=25&genre=TECHNO&genre=NOPE&genre=HOUSE" +
        "&date=2026-10-16&from=22:00&to=04:00&budget=1500&travel=1&type=CLUB&type=SPACESHIP&kind=VENUE_SEEKING",
    );
    expect(state).toEqual({
      tab: "venues",
      center: { lat: 50.06, lng: 19.94, label: "Kraków", area: false },
      radiusKm: 25,
      genres: ["TECHNO", "HOUSE"],
      date: "2026-10-16",
      from: "22:00",
      to: "04:00",
      budget: 1500,
      willTravel: true,
      types: ["CLUB"],
      kind: "VENUE_SEEKING",
    });
  });

  it("falls back to defaults", () => {
    expect(parse("tab=moon&lat=95&lng=19&radius=900&date=jutro&from=25:00&budget=-3")).toEqual({
      tab: "artists",
      radiusKm: 50,
      genres: [],
      willTravel: false,
      types: [],
    });
    expect(parse("lat=50.06").center).toBeUndefined();
    expect(parse("lat=50.06&lng=19.94&area=1").center).toEqual({ lat: 50.06, lng: 19.94, area: true });
    // Map areas may have any whole radius.
    expect(parse("radius=37").radiusKm).toBe(37);
  });

  it("round-trips through the URL", () => {
    const state = parse(
      "tab=listings&lat=50.06&lng=19.94&area=1&radius=37&genre=TECHNO&date=2026-10-16&kind=ARTIST_AVAILABLE",
    );
    const href = searchHref(state);
    expect(href.startsWith("/search?")).toBe(true);
    expect(parseSearch(new URL(href, "http://x").searchParams, "artists")).toEqual(state);
  });
});

describe("defaultTab", () => {
  it("depends on the role", () => {
    expect(defaultTab("VENUE")).toBe("artists");
    expect(defaultTab("ARTIST")).toBe("listings");
    expect(defaultTab("ADMIN")).toBe("artists");
  });
});

describe("queries", () => {
  it("sends artists' time as a whole range, the end after midnight on the next day", () => {
    const state = parse("genre=TECHNO&date=2026-10-16&from=22:00&to=04:00&budget=1500&travel=1&radius=25");
    expect(artistQuery(state, center)).toEqual({
      lat: 50.06,
      lng: 19.94,
      radiusKm: 25,
      genres: ["TECHNO"],
      from: "2026-10-16T20:00:00.000Z",
      to: "2026-10-17T02:00:00.000Z",
      budget: 150000,
      willTravel: true,
    });
    // A date alone does not filter artists: they must be free for a given time.
    expect(artistQuery(parse("date=2026-10-16"), center)).toEqual({ lat: 50.06, lng: 19.94, radiusKm: 50 });
  });

  it("sends venues' types", () => {
    expect(venueQuery(parse("type=CLUB&type=BAR&genre=HOUSE&budget=100"), center)).toEqual({
      lat: 50.06,
      lng: 19.94,
      radiusKm: 50,
      genres: ["HOUSE"],
      types: ["CLUB", "BAR"],
    });
  });

  it("sends listings a whole day when only the date is given", () => {
    expect(listingQuery(parse("kind=VENUE_SEEKING&date=2026-10-25&budget=800"), center)).toEqual({
      lat: 50.06,
      lng: 19.94,
      radiusKm: 50,
      kind: "VENUE_SEEKING",
      from: "2026-10-24T22:00:00.000Z",
      // 25 October has 25 hours: the clocks go back.
      to: "2026-10-25T23:00:00.000Z",
      budget: 80000,
    });
    expect(listingQuery(parse("date=2026-10-16&from=20:00&to=23:00"), center)).toMatchObject({
      from: "2026-10-16T18:00:00.000Z",
      to: "2026-10-16T21:00:00.000Z",
    });
  });
});
