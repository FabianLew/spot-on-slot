import { MAX_RADIUS_KM, type Center } from "./search-params";

/** What the map shows after a move. */
export type MapView = {
  center: Center;
  bounds: { north: number; south: number; east: number; west: number };
  zoom: number;
};

/** Delay after the map stops moving before its area is searched. */
export const IDLE_MS = 800;
/** Zoom steps smaller than this, with a small pan, are not worth a search. */
const ZOOM_STEP = 0.5;
/** A pan shorter than this share of the view (per axis) is not worth a search. */
const PAN_SHARE = 0.25;

const EARTH_KM = 6371;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in km. */
export function distanceKm(a: Center, b: Center): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The radius that covers the whole view: centre to the farthest corner, in whole km within 1–200. */
export function viewRadiusKm({ center, bounds }: MapView): number {
  const corners = [
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.south, lng: bounds.west },
  ];
  const farthest = Math.max(...corners.map((corner) => distanceKm(center, corner)));
  return Math.min(MAX_RADIUS_KM, Math.max(1, Math.ceil(farthest)));
}

/** Whether `next` differs enough from the last searched view: another zoom or a pan past a quarter of the view. */
export function worthSearching(last: MapView | undefined, next: MapView): boolean {
  if (!last) return true;
  if (Math.abs(next.zoom - last.zoom) >= ZOOM_STEP) return true;
  const height = Math.abs(last.bounds.north - last.bounds.south);
  const width = Math.abs(last.bounds.east - last.bounds.west);
  return (
    Math.abs(next.center.lat - last.center.lat) > height * PAN_SHARE ||
    Math.abs(next.center.lng - last.center.lng) > width * PAN_SHARE
  );
}

/** Calls `onIdle` once the map has stood still for `delay` ms after a move; a new move cancels the wait. */
export function createIdleTrigger(onIdle: (view: MapView) => void, delay = IDLE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    moveStart: cancel,
    moveEnd(view: MapView) {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        onIdle(view);
      }, delay);
    },
    cancel,
  };
}

/** Results sharing one point (artists in the same ~1 km cell, venues in one building) under one pin. */
export function groupPins<T extends { lat: number; lng: number }>(
  items: T[],
): { lat: number; lng: number; items: T[] }[] {
  const groups = new Map<string, { lat: number; lng: number; items: T[] }>();
  for (const item of items) {
    const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { lat: item.lat, lng: item.lng, items: [item] });
  }
  return [...groups.values()];
}
