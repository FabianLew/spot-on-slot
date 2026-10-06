"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Button,
  Checkbox,
  Label,
  LocationPicker,
  PageHeader,
  Panel,
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
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("search.title")} />

      <div role="group" aria-label={t("search.tabsLabel")} className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab}
            type="button"
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
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="md:hidden"
            aria-expanded={filtersOpen}
            aria-controls="search-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {t("search.filters.open")}
          </Button>
          <Panel id="search-filters" className={cn(filtersOpen ? "block" : "hidden", "md:block")}>
            <SearchFilters key={state.tab} state={state} onChange={update} />
          </Panel>
        </div>

        {center ? (
          <Results
            state={state}
            center={center}
            view={view}
            onView={setView}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onArea={(area) =>
              update({
                center: { lat: round(area.center.lat), lng: round(area.center.lng), area: true },
                radiusKm: viewRadiusKm(area),
              })
            }
          />
        ) : (
          // Without a place the bar above asks for one.
          <Panel aria-busy={own.pending ? "true" : undefined} className="min-h-40" />
        )}
      </div>
    </section>
  );
}

function PlaceBar({
  label,
  missing,
  radiusKm,
  onPlace,
  onRadius,
}: {
  label?: string;
  missing: boolean;
  radiusKm: number;
  onPlace: (place: { lat: number; lng: number; label: string }) => void;
  onRadius: (radiusKm: number) => void;
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
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-bold uppercase text-muted-foreground">{t("search.place.label")}</span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold uppercase break-words">{label ?? t("search.place.none")}</span>
            {!missing && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-expanded={open}
                onClick={() => setEditing((on) => !on)}
              >
                {editing ? t("search.place.cancel") : t("search.place.change")}
              </Button>
            )}
          </span>
        </div>
        <div className="flex min-w-32 flex-col gap-1">
          <Label htmlFor="search-radius">{t("search.radius")}</Label>
          <Select value={String(radiusKm)} onValueChange={(value) => onRadius(Number(value))}>
            <SelectTrigger id="search-radius" className="w-full">
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
    </Panel>
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
}: {
  state: SearchState;
  center: { lat: number; lng: number };
  view: "list" | "map";
  onView: (view: "list" | "map") => void;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onArea: (view: MapView) => void;
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
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase" aria-live="polite">
          {list.isSuccess ? t("search.count", { count: total }) : " "}
        </p>
        <div role="group" aria-label={t("search.view.label")} className="flex gap-2 md:hidden">
          {(["list", "map"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={view === option ? "default" : "outline"}
              aria-pressed={view === option}
              onClick={() => onView(option)}
            >
              {t(`search.view.${option}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn("min-w-0 flex-col gap-3", view === "map" ? "hidden md:flex" : "flex")}>
          {list.isError ? (
            <ApiErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.isPending ? (
            <Panel aria-busy="true" className="h-40" />
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
                  disabled={list.isFetchingNextPage}
                  onClick={() => list.fetchNextPage()}
                >
                  {t("search.more")}
                </Button>
              )}
            </>
          )}
        </div>

        <div className={cn("min-w-0 flex-col gap-2", view === "list" ? "hidden md:flex" : "flex")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
          <div className="h-[60vh] min-h-80 border-2 border-border md:sticky md:top-4 lg:h-[70vh]">
            <SearchMap
              pins={mapPins}
              focus={focus}
              selectedId={selectedId}
              onSelect={select}
              onSettle={onSettle}
              labels={labels}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
