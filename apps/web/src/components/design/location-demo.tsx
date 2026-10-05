"use client";

import { toApiProblem, unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, LocationPicker, Panel, Skeleton, toast } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { api } from "@/lib/api";
import { fallbackMessage } from "@/lib/problem-text";

type Place = ApiSchemas["PlaceResponse"];
type SavedLocation = ApiSchemas["LocationResponse"];
type Source = ApiSchemas["SetLocationRequest"]["source"];

const MY_LOCATION = ["location", "me"] as const;
const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Preview of the B3 location flow against the real backend; onboarding (W2) will reuse the pieces. */
export function LocationDemo() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const term = useDebounced(query.trim(), DEBOUNCE_MS);

  const current = useQuery({
    queryKey: MY_LOCATION,
    queryFn: async (): Promise<SavedLocation | null> => {
      const result = await api.GET("/api/v1/locations/me");
      if (result.response.status === 404) return null;
      return unwrap(result);
    },
  });

  const suggestions = useQuery({
    queryKey: ["location", "search", term],
    queryFn: async () => unwrap(await api.GET("/api/v1/locations/search", { params: { query: { q: term } } })),
    enabled: term.length >= MIN_QUERY,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (body: { latitude: number; longitude: number; source: Source }) =>
      unwrap(await api.PUT("/api/v1/locations/me", { body })),
    meta: { handlesErrors: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(MY_LOCATION, saved);
      setQuery("");
      toast.success(t("design.location.saved", { label: saved.label }));
    },
    onError: (failure) => setError(problemText(failure)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE("/api/v1/locations/me"));
    },
    onSuccess: () => {
      queryClient.setQueryData(MY_LOCATION, null);
      toast.success(t("design.location.deleted"));
    },
  });

  function problemText(failure: unknown) {
    const problem = toApiProblem(failure);
    return problem.detail || problem.title || fallbackMessage(t, problem);
  }

  function onSelect(place: Place) {
    setError(undefined);
    save.mutate({ latitude: place.latitude, longitude: place.longitude, source: "MANUAL" });
  }

  function onUseDevice() {
    setError(undefined);
    if (!("geolocation" in navigator)) return setError(t("design.location.unsupported"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        save.mutate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "DEVICE",
        });
      },
      (failure) => {
        setLocating(false);
        setError(t(failure.code === failure.PERMISSION_DENIED ? "design.location.denied" : "design.location.unavailable"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const searchError = suggestions.error ? problemText(suggestions.error) : undefined;
  // Keep the previous list while the next one loads, but only for the term it belongs to.
  const shown = term.length >= MIN_QUERY && query.trim().length >= MIN_QUERY ? (suggestions.data ?? []) : [];

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <Panel>
        <LocationPicker
          labels={{
            search: t("design.location.search"),
            placeholder: t("design.location.placeholder"),
            useDevice: t("design.location.useDevice"),
            locating: t("design.location.locating"),
            searching: t("design.location.searching"),
            noResults: t("design.location.noResults"),
          }}
          query={query}
          onQueryChange={setQuery}
          suggestions={shown}
          searching={query.trim() !== term || suggestions.isFetching}
          onSelect={onSelect}
          onUseDevice={onUseDevice}
          locating={locating || save.isPending}
          error={error ?? searchError}
        />
      </Panel>
      <Panel title={t("design.location.current")}>
        {current.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : current.isError ? (
          <ApiErrorState error={current.error} onRetry={() => current.refetch()} />
        ) : current.data ? (
          <div className="flex flex-col gap-3">
            <p className="font-display text-lg">{current.data.label}</p>
            <p className="text-sm text-muted-foreground">
              {t("design.location.approx", {
                latitude: current.data.latitude.toFixed(2),
                longitude: current.data.longitude.toFixed(2),
              })}
            </p>
            <p className="text-sm">{t(`design.location.sources.${current.data.source}`)}</p>
            <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending} className="self-start">
              {t("design.location.delete")}
            </Button>
          </div>
        ) : (
          <p className="text-sm">{t("design.location.none")}</p>
        )}
      </Panel>
    </div>
  );
}
