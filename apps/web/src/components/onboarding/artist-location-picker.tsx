"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LocationPicker } from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { problemMessage } from "@/lib/problem-text";
import { ARTIST_PROFILE } from "./queries";
import { usePlaceSearch } from "./use-place-search";

type Source = "DEVICE" | "MANUAL";

/**
 * The artist's town: from the browser or a picked suggestion, saved at once to `PUT /locations/me` (it is its own
 * resource, not part of the profile save). The profile is read again afterwards, since it shows the town.
 */
export function ArtistLocationPicker({ error: outerError, onChange }: { error?: string; onChange?: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const places = usePlaceSearch();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();

  const save = useMutation({
    mutationFn: async (body: { latitude: number; longitude: number; source: Source }) =>
      unwrap(await api.PUT("/api/v1/locations/me", { body })),
    meta: { handlesErrors: true },
    onSuccess: async () => {
      places.setQuery("");
      await queryClient.invalidateQueries({ queryKey: ARTIST_PROFILE });
    },
    onError: (failure) => setError(problemMessage(t, failure)),
  });

  function start() {
    setError(undefined);
    onChange?.();
  }

  function onUseDevice() {
    start();
    if (!("geolocation" in navigator)) return setError(t("onboarding.location.unsupported"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        save.mutate({ latitude: position.coords.latitude, longitude: position.coords.longitude, source: "DEVICE" });
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
    <LocationPicker
      labels={{
        search: t("onboarding.location.search"),
        placeholder: t("onboarding.location.placeholder"),
        useDevice: t("onboarding.location.useDevice"),
        locating: t("onboarding.location.locating"),
        searching: t("onboarding.location.searching"),
        noResults: t("onboarding.location.noResults"),
      }}
      query={places.query}
      onQueryChange={places.setQuery}
      suggestions={places.suggestions}
      searching={places.searching}
      onSelect={(place) => {
        start();
        save.mutate({ latitude: place.latitude, longitude: place.longitude, source: "MANUAL" });
      }}
      onUseDevice={onUseDevice}
      locating={locating || save.isPending}
      error={error ?? outerError ?? (places.error ? problemMessage(t, places.error) : undefined)}
    />
  );
}
