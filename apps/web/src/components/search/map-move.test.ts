import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleTrigger, groupPins, viewRadiusKm, worthSearching, type MapView } from "./map-move";

const view = (overrides: Partial<MapView> = {}): MapView => ({
  center: { lat: 50.06, lng: 19.94 },
  // Roughly 20 km wide around Kraków.
  bounds: { north: 50.11, south: 50.01, east: 20.08, west: 19.8 },
  zoom: 11,
  ...overrides,
});

describe("viewRadiusKm", () => {
  it("is the distance from the centre to a corner, whole km within 1–200", () => {
    expect(viewRadiusKm(view())).toBe(12);
    expect(viewRadiusKm(view({ bounds: { north: 50.0601, south: 50.0599, east: 19.9401, west: 19.9399 } }))).toBe(1);
    expect(viewRadiusKm(view({ bounds: { north: 55, south: 45, east: 30, west: 10 } }))).toBe(200);
  });
});

describe("worthSearching", () => {
  it("skips small moves at the same zoom", () => {
    const before = view();
    expect(worthSearching(before, view({ center: { lat: 50.07, lng: 19.96 } }))).toBe(false);
    expect(worthSearching(before, view({ center: { lat: 50.06, lng: 20.02 } }))).toBe(true);
    expect(worthSearching(before, view({ zoom: 12 }))).toBe(true);
    expect(worthSearching(before, view({ zoom: 11.2 }))).toBe(false);
    expect(worthSearching(undefined, before)).toBe(true);
  });
});

describe("createIdleTrigger", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires 0.8 s after the map stops, never while it moves", () => {
    const fired: MapView[] = [];
    const trigger = createIdleTrigger((settled) => fired.push(settled), 800);

    trigger.moveEnd(view({ zoom: 10 }));
    vi.advanceTimersByTime(500);
    trigger.moveStart();
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);

    trigger.moveEnd(view({ zoom: 12 }));
    vi.advanceTimersByTime(799);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([view({ zoom: 12 })]);

    trigger.moveEnd(view());
    trigger.cancel();
    vi.advanceTimersByTime(1000);
    expect(fired).toHaveLength(1);
  });
});

describe("groupPins", () => {
  it("puts results on the same point under one pin", () => {
    const pins = groupPins([
      { id: "a", lat: 50.06, lng: 19.94 },
      { id: "b", lat: 50.07, lng: 19.95 },
      { id: "c", lat: 50.06, lng: 19.94 },
    ]);
    expect(pins.map((pin) => pin.items.map((item) => item.id))).toEqual([["a", "c"], ["b"]]);
    expect(pins[0]).toMatchObject({ lat: 50.06, lng: 19.94 });
  });
});
