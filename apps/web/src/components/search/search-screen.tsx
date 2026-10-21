"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Button,
  Checkbox,
  Label,
  LocationPicker,
  Panel,
  PixelPin,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { usePlaceSearch } from "@/components/onboarding/use-place-search";
import { useSession } from "@/components/session/session-provider";
import { problemMessage } from "@/lib/problem-text";
import { viewRadiusKm, worthSearching, type MapView } from "./map-move";
import { useOwnPlace, useSearchList, useSearchPins } from "./queries";
import { ResultCard, hitHref, hitId, hitTitle } from "./result-cards";
import { SearchFilters } from "./search-filters";
import type { MapPin, SearchMapLabels } from "./search-map";
import { SearchMap } from "./search-map-lazy";
import { RADII, TABS, defaultTab, parseSearch, searchHref, type SearchState } from "./search-params";

/** "Szukaj przy przesuwaniu mapy": a per-viewer convenience, on unless switched off. */
const AUTO_AREA_KEY = "sos.search.autoArea";

const autoAreaListeners = new Set<() => void>();
let autoAreaFallback = true;

function readAutoArea(): boolean {
  try {
    return window.localStorage.getItem(AUTO_AREA_KEY) !== "0";
  } catch {
    return autoAreaFallback;
  }
}

function storeAutoArea(on: boolean) {
  autoAreaFallback = on;
  try {
    window.localStorage.setItem(AUTO_AREA_KEY, on ? "1" : "0");
  } catch {
    // Private windows may refuse storage; the switch then lasts for this visit only.
  }
  autoAreaListeners.forEach((listener) => listener());
}

function useAutoArea(): boolean {
  return useSyncExternalStore(
    (listener) => {
      autoAreaListeners.add(listener);
      return () => autoAreaListeners.delete(listener);
    },
    readAutoArea,
    () => true,
  );
}

const round = (degrees: number) => Math.round(degrees * 1e5) / 1e5;

/** The "Szukaj" tab: artists, venues or listings near a place, as a list and on a map. */
export function SearchScreen() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";

  const state = useMemo(() => {
    const parsed = parseSearch(params, defaultTab(role));
    // An artist's first look: venues looking for an artist.
    if (!params.has("tab") && role === "ARTIST") parsed.kind = "VENUE_SEEKING";
    return parsed;
  }, [params, role]);

  // The address changes a moment after `replace`, so quick changes build on the last state written, not the last
  // render. An earlier write of ours landing after a later one was sent is skipped; anything else (back button) wins.
  const written = useRef({ state, sent: [] as string[] });
  useEffect(() => {
    const { sent } = written.current;
    const at = sent.indexOf(searchHref(state));
    if (at === -1 || at === sent.length - 1) written.current = { state, sent: [] };
  }, [state]);
  const update = useCallback(
    (patch: Partial<SearchState>) => {
      const next = { ...written.current.state, ...patch };
      const href = searchHref(next);
      written.current = { state: next, sent: [...written.current.sent, href] };
      router.replace(href, { scroll: false });
    },
    [router],
  );

  const own = useOwnPlace(role);
  const center = state.center ?? own.place ?? undefined;
  const placeLabel = state.center?.area
    ? t("search.place.area")
    : (state.center?.label ?? (state.center ? t("search.place.picked") : own.place?.label));

  const [selectedId, setSelectedId] = useState<string>();
  // The map is the centre of the screen; phones start on it too.
  const [view, setView] = useState<"list" | "map">("map");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active = activeFilters(state);

  return (
    <section
      data-layout="full"
      className="flex h-[calc(100dvh-10rem)] min-h-[30rem] flex-col gap-2 md:h-[calc(100dvh-2rem)] md:gap-3"
    >
      <h1 className="sr-only">{t("search.title")}</h1>

      <div className="flex flex-col gap-2 border-2 border-border bg-card p-2 lg:flex-row lg:items-center">
        <div role="group" aria-label={t("search.tabsLabel")} className="flex gap-1.5">
          {TABS.map((tab) => (
            <Button
              key={tab}
              type="button"
              size="sm"
              className="flex-1 lg:flex-none"
              variant={state.tab === tab ? "default" : "outline"}
              aria-pressed={state.tab === tab}
              onClick={() => {
                setSelectedId(undefined);
                update({ tab });
              }}
            >
              {t(`search.tabs.${tab}`)}
            </Button>
          ))}
        </div>
        <PlaceBar
          label={placeLabel}
          missing={center == null && !own.pending}
          radiusKm={state.radiusKm}
          onPlace={(place) => update({ center: { ...place, area: false } })}
          onRadius={(radiusKm) => update({ radiusKm })}
          filters={
            <Button
              type="button"
              size="sm"
              variant={filtersOpen ? "default" : "outline"}
              aria-expanded={filtersOpen}
              aria-controls="search-filters"
              onClick={() => {
                setFiltersOpen((open) => !open);
                setView("list");
              }}
            >
              {t("search.filters.open")}
              {active > 0 && (
                <span className="ml-1 bg-highlight px-1.5 text-[0.65rem] text-foreground">{active}</span>
              )}
            </Button>
          }
        />
      </div>

      {center ? (
        <Results
          state={state}
          center={center}
          view={view}
          onView={setView}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={
            <Panel id="search-filters" className={cn(filtersOpen ? "block" : "hidden", "shrink-0")}>
              <SearchFilters key={state.tab} state={state} onChange={update} />
            </Panel>
          }
          onArea={(area) =>
            update({
              center: { lat: round(area.center.lat), lng: round(area.center.lng), area: true },
              radiusKm: viewRadiusKm(area),
            })
          }
        />
      ) : (
        // Without a place the bar above asks for one.
        <Panel aria-busy={own.pending ? "true" : undefined} className="min-h-40 flex-1" />
      )}
    </section>
  );
}

/** How many filters narrow the current tab, for the badge on "Filtry". */
function activeFilters(state: SearchState): number {
  const timed = state.tab !== "venues";
  return (
    state.genres.length +
    (state.tab === "venues" ? state.types.length : 0) +
    (state.tab === "listings" && state.kind ? 1 : 0) +
    (timed && (state.date || state.from || state.to) ? 1 : 0) +
    (timed && state.budget != null ? 1 : 0) +
    (state.tab === "artists" && state.willTravel ? 1 : 0)
  );
}

function PlaceBar({
  label,
  missing,
  radiusKm,
  onPlace,
  onRadius,
  filters,
}: {
  label?: string;
  missing: boolean;
  radiusKm: number;
  onPlace: (place: { lat: number; lng: number; label: string }) => void;
  onRadius: (radiusKm: number) => void;
  filters: ReactNode;
}) {
  const t = useTranslations();
  const places = usePlaceSearch();
  const [editing, setEditing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const open = editing || missing;
  const radii = (RADII as readonly number[]).includes(radiusKm) ? RADII : [...RADII, radiusKm].sort((a, b) => a - b);

  function pick(place: { lat: number; lng: number; label: string }) {
    setEditing(false);
    setError(undefined);
    places.setQuery("");
    onPlace(place);
  }

  function useDevice() {
    setError(undefined);
    if (!("geolocation" in navigator)) return setError(t("onboarding.location.unsupported"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        // Only for this search: nothing is saved.
        pick({
          lat: round(position.coords.latitude),
          lng: round(position.coords.longitude),
          label: t("search.place.device"),
        });
      },
      (failure) => {
        setLocating(false);
        setError(
          t(
            failure.code === failure.PERMISSION_DENIED
              ? "onboarding.location.denied"
              : "onboarding.location.unavailable",
          ),
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          <PixelPin aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="sr-only">{t("search.place.label")}</span>
          <span className="truncate text-sm font-bold uppercase">{label ?? t("search.place.none")}</span>
          {!missing && (
            <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setEditing((on) => !on)}>
              {editing ? t("search.place.cancel") : t("search.place.change")}
            </Button>
          )}
        </div>
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <Label htmlFor="search-radius" className="m-0 text-xs">
            {t("search.radius")}
          </Label>
          <Select value={String(radiusKm)} onValueChange={(value) => onRadius(Number(value))}>
            <SelectTrigger id="search-radius" className="h-9 w-28 whitespace-nowrap">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {radii.map((km) => (
                <SelectItem key={km} value={String(km)}>
                  {t("search.radiusKm", { km })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters}
        </div>
      </div>
      {missing && <p className="text-sm">{t("search.needPlace")}</p>}
      {open && (
        <LocationPicker
          labels={{
            search: t("search.place.search"),
            placeholder: t("search.place.placeholder"),
            useDevice: t("search.place.useDevice"),
            locating: t("onboarding.location.locating"),
            searching: t("onboarding.location.searching"),
            noResults: t("onboarding.location.noResults"),
          }}
          query={places.query}
          onQueryChange={places.setQuery}
          suggestions={places.suggestions}
          searching={places.searching}
          onSelect={(place) => pick({ lat: place.latitude, lng: place.longitude, label: place.label })}
          onUseDevice={useDevice}
          locating={locating}
          error={error ?? (places.error ? problemMessage(t, places.error) : undefined)}
        />
      )}
    </div>
  );
}

function Results({
  state,
  center,
  view,
  onView,
  selectedId,
  onSelect,
  onArea,
  filters,
}: {
  state: SearchState;
  center: { lat: number; lng: number };
  view: "list" | "map";
  onView: (view: "list" | "map") => void;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onArea: (view: MapView) => void;
  filters: ReactNode;
}) {
  const t = useTranslations();
  const list = useSearchList(state, center);
  const pins = useSearchPins(state, center);
  const autoArea = useAutoArea();
  const [pendingArea, setPendingArea] = useState<MapView>();
  const baseline = useRef<MapView | undefined>(undefined);

  const hits = useMemo(() => list.data?.pages.flatMap((page) => page.hits) ?? [], [list.data]);
  const total = list.data?.pages[0]?.totalElements ?? 0;
  const mapPins = useMemo(
    () =>
      (pins.data?.hits ?? []).map((hit): MapPin => {
        const base = {
          id: hitId(hit),
          lat: hit.hit.latitude,
          lng: hit.hit.longitude,
          title: hitTitle(hit),
          href: hitHref(hit),
        };
        if (hit.tab === "artists") return { ...base, kind: "artist", subtitle: hit.hit.city, approximate: true };
        if (hit.tab === "venues")
          return { ...base, kind: "venue", subtitle: t(`venueTypes.${hit.hit.type}`), approximate: false };
        const byArtist = hit.hit.kind === "ARTIST_AVAILABLE";
        return {
          ...base,
          kind: byArtist ? "artist" : "venue",
          subtitle: t(`listings.kind.${hit.hit.kind}`),
          approximate: byArtist,
        };
      }),
    [pins.data, t],
  );

  // Fly only when the place or radius was chosen, not when the map's own area was searched.
  const focusKey = state.center?.area ? undefined : `${center.lat},${center.lng},${state.radiusKm}`;
  const [focus, setFocus] = useState({
    lat: center.lat,
    lng: center.lng,
    radiusKm: state.radiusKm,
    key: focusKey ?? "",
  });
  if (focusKey != null && focusKey !== focus.key) {
    setFocus({ lat: center.lat, lng: center.lng, radiusKm: state.radiusKm, key: focusKey });
  }

  const labels = useMemo<SearchMapLabels>(
    () => ({
      region: t("search.map.label"),
      approximate: t("search.map.approximate"),
      group: (count) => t("search.map.group", { count }),
    }),
    [t],
  );

  const onSettle = useCallback(
    (settled: MapView, byUser: boolean) => {
      if (!byUser) {
        baseline.current = settled;
        setPendingArea(undefined);
        return;
      }
      if (!worthSearching(baseline.current, settled)) return;
      if (autoArea) {
        baseline.current = settled;
        setPendingArea(undefined);
        onArea(settled);
      } else {
        setPendingArea(settled);
      }
    },
    [autoArea, onArea],
  );

  const select = useCallback(
    (id: string) => {
      onSelect(id);
      document.getElementById(`result-${id}`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    },
    [onSelect],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div role="group" aria-label={t("search.view.label")} className="flex gap-1.5 md:hidden">
        {(["map", "list"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            className="flex-1"
            variant={view === option ? "default" : "outline"}
            aria-pressed={view === option}
            onClick={() => onView(option)}
          >
            {t(`search.view.${option}`)}
          </Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(18rem,24rem)_1fr] xl:grid-cols-[26rem_1fr]">
        <div
          className={cn(
            "min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain md:pr-1",
            view === "map" ? "hidden md:flex" : "flex",
          )}
        >
          {filters}
          <p className="text-sm font-bold uppercase" aria-live="polite">
            {list.isSuccess ? t("search.count", { count: total }) : "\u00a0"}
          </p>
          {list.isError ? (
            <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.isPending ? (
            <Panel aria-busy="true" className="h-40 shrink-0" />
          ) : hits.length === 0 ? (
            <Panel>
              <p className="text-sm">{t("search.empty")}</p>
            </Panel>
          ) : (
            <>
              <ul
                aria-label={t("search.results")}
                className={cn("flex flex-col gap-3", list.isPlaceholderData && "opacity-60")}
              >
                {hits.map((hit) => (
                  <ResultCard key={hitId(hit)} hit={hit} selected={hitId(hit) === selectedId} />
                ))}
              </ul>
              {list.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={list.isFetchingNextPage}
                  onClick={() => list.fetchNextPage()}
                >
                  {t("search.more")}
                </Button>
              )}
            </>
          )}
        </div>

        <div
          className={cn(
            "relative min-h-0 min-w-0 border-2 border-border",
            view === "list" ? "hidden md:block" : "block",
          )}
        >
          <SearchMap
            pins={mapPins}
            focus={focus}
            selectedId={selectedId}
            onSelect={select}
            onSettle={onSettle}
            labels={labels}
          />
          <div className="pointer-events-none absolute left-2 right-12 top-2 flex flex-wrap items-start gap-2">
            <div className="pointer-events-auto flex items-center gap-2 border-2 border-border bg-card px-2 py-1.5 shadow-[3px_3px_0_0_var(--color-foreground)]">
              <Checkbox
                id="search-auto-area"
                checked={autoArea}
                onCheckedChange={(checked) => {
                  const on = checked === true;
                  storeAutoArea(on);
                  if (on) setPendingArea(undefined);
                }}
              />
              <Label htmlFor="search-auto-area" className="m-0 text-xs">
                {t("search.autoArea")}
              </Label>
            </div>
            {pendingArea && (
              <Button
                type="button"
                size="sm"
                className="pointer-events-auto shadow-[3px_3px_0_0_var(--color-foreground)]"
                onClick={() => {
                  baseline.current = pendingArea;
                  setPendingArea(undefined);
                  onArea(pendingArea);
                }}
              >
                {t("search.searchArea")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
