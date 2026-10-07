"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { createIdleTrigger, groupPins, type MapView } from "./map-move";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  kind: "artist" | "venue";
  title: string;
  subtitle?: string;
  href: string;
  /** Artists' points are approximated (~1 km); the popup says so. */
  approximate: boolean;
};

export type MapFocus = { lat: number; lng: number; radiusKm: number; key: string };

export type SearchMapLabels = {
  region: string;
  approximate: string;
  group: (count: number) => string;
};

export type SearchMapProps = {
  pins: MapPin[];
  /** Where to look; the map flies there when `key` changes (not after searching the map's own area). */
  focus: MapFocus;
  selectedId?: string;
  onSelect: (id: string) => void;
  /** The map stood still after a move; `byUser` is false after flying to `focus`. */
  onSettle: (view: MapView, byUser: boolean) => void;
  labels: SearchMapLabels;
};

/** Copied there by scripts/copy-maplibre-worker.mjs on dev and build. */
const WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";

/** OpenStreetMap vector tiles from OpenFreeMap (free, no key); `NEXT_PUBLIC_MAP_STYLE_URL` replaces both styles. */
const STYLES = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark",
};

/** A square around the circle of `radiusKm`. */
function circleBounds({ lat, lng, radiusKm }: MapFocus): LngLatBounds {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return new LngLatBounds([lng - dLng, lat - dLat], [lng + dLng, lat + dLat]);
}

function readView(map: MapLibreMap): MapView {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    center: { lat: center.lat, lng: center.lng },
    bounds: { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() },
    zoom: map.getZoom(),
  };
}

function pinElement(kind: MapPin["kind"], count: number, label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", label);
  element.className =
    "sos-pin flex size-7 items-center justify-center border-2 border-foreground text-[0.625rem] font-bold shadow-[2px_2px_0_0_var(--color-foreground)] " +
    (kind === "artist" ? "bg-primary text-primary-foreground" : "bg-highlight text-highlight-foreground");
  element.textContent = count > 1 ? String(count) : "";
  return element;
}

function popupContent(items: MapPin[], labels: SearchMapLabels): HTMLElement {
  const root = document.createElement("div");
  root.className = "flex max-h-56 flex-col gap-2 overflow-y-auto font-mono text-xs";
  if (items.length > 1) {
    const head = document.createElement("p");
    head.className = "font-bold uppercase";
    head.textContent = labels.group(items.length);
    root.append(head);
  }
  for (const item of items) {
    const row = document.createElement("div");
    const link = document.createElement("a");
    link.href = item.href;
    link.className = "font-bold uppercase underline";
    link.textContent = item.title;
    row.append(link);
    const note = [item.subtitle, item.approximate ? labels.approximate : undefined].filter(Boolean).join(" · ");
    if (note) {
      const small = document.createElement("p");
      small.className = "text-muted-foreground";
      small.textContent = note;
      row.append(small);
    }
    root.append(row);
  }
  return root;
}

/** The results on a MapLibre map: pixel pins (red artists, yellow venues), grouped when they share a point. */
export function SearchMap({ pins, focus, selectedId, onSelect, onSettle, labels }: SearchMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<{ marker: Marker; ids: string[] }[]>([]);
  const callbacks = useRef({ onSelect, onSettle });
  useEffect(() => {
    callbacks.current = { onSelect, onSettle };
  }, [onSelect, onSettle]);
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? STYLES.dark : STYLES.light;
  const initial = useRef({ focus, style });

  useEffect(() => {
    if (!container.current) return;
    // The bundle loses MapLibre's own worker path; without a worker only the pins show, no map.
    setWorkerUrl(new URL(WORKER_PATH, window.location.origin).href);
    const map = new MapLibreMap({
      container: container.current,
      style: initial.current.style,
      bounds: circleBounds(initial.current.focus),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    // A move counts as the user's if any of its events came from input; drag inertia continues without one.
    let byUser = false;
    const trigger = createIdleTrigger((view) => {
      const user = byUser;
      byUser = false;
      callbacks.current.onSettle(view, user);
    });
    map.on("load", () => callbacks.current.onSettle(readView(map), false));
    map.on("movestart", (event) => {
      if (event.originalEvent) byUser = true;
      trigger.moveStart();
    });
    map.on("move", (event) => {
      if (event.originalEvent) byUser = true;
    });
    map.on("moveend", () => trigger.moveEnd(readView(map)));

    // The map can start hidden (phones show the list first); size it once it is shown.
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      trigger.cancel();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(style);
  }, [style]);

  useEffect(() => {
    mapRef.current?.fitBounds(circleBounds(focus), { duration: 600 });
    // Only a new place moves the map, not new results for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach(({ marker }) => marker.remove());
    markers.current = groupPins(pins).map((group) => {
      const first = group.items[0]!;
      const label = group.items.length > 1 ? labels.group(group.items.length) : first.title;
      const element = pinElement(first.kind, group.items.length, label);
      element.addEventListener("click", () => callbacks.current.onSelect(first.id));
      const marker = new Marker({ element, anchor: "center" })
        .setLngLat([group.lng, group.lat])
        .setPopup(
          new Popup({ offset: 16, closeButton: false, maxWidth: "240px" }).setDOMContent(
            popupContent(group.items, labels),
          ),
        )
        .addTo(map);
      return { marker, ids: group.items.map((item) => item.id) };
    });
  }, [pins, labels]);

  useEffect(() => {
    markers.current.forEach(({ marker, ids }) => {
      const element = marker.getElement();
      const selected = selectedId != null && ids.includes(selectedId);
      element.classList.toggle("ring-4", selected);
      element.classList.toggle("ring-ring", selected);
      element.style.zIndex = selected ? "2" : "";
    });
  }, [selectedId, pins]);

  return <div ref={container} role="region" aria-label={labels.region} className="size-full min-h-80" />;
}
