"use client";

import type { ApiSchemas } from "@spot-on-slot/api-client";
import { useTranslations } from "next-intl";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, LocationPicker } from "@spot-on-slot/ui";
import { problemMessage } from "@/lib/problem-text";
import { usePlaceSearch } from "./use-place-search";

type Address = ApiSchemas["VenueAddress"];
export type Point = { latitude: number; longitude: number };

/** Whether the backend placed an address on the map (it sends null for a missing point). */
export function located(address: Address | null | undefined) {
  return address?.latitude != null && address.longitude != null;
}

interface VenueAddressFieldsProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  names: { street: Path<T>; postalCode: Path<T>; city: Path<T> };
  /** A suggestion was picked: the fields are filled and this is its point. */
  onPick: (point: Point) => void;
  /** A field was typed in, so any picked point no longer matches the text. */
  onEdit: () => void;
}

/**
 * The venue address as in the wizard and the venue form: a search with suggestions that fills street, postal code and
 * city, plus the fields themselves.
 */
export function VenueAddressFields<T extends FieldValues>({ form, names, onPick, onEdit }: VenueAddressFieldsProps<T>) {
  const t = useTranslations();
  const places = usePlaceSearch();
  const set = (name: Path<T>, value: string, validate = false) =>
    form.setValue(name, value as PathValue<T, Path<T>>, { shouldValidate: validate, shouldDirty: true });

  const field = (name: Path<T>, label: string, autoComplete: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field: input }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...input}
              autoComplete={autoComplete}
              onChange={(event) => {
                onEdit();
                input.onChange(event);
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <>
      <LocationPicker
        labels={{
          search: t("onboarding.venue.address.search"),
          placeholder: t("onboarding.venue.address.placeholder"),
          useDevice: "",
          locating: t("onboarding.location.locating"),
          searching: t("onboarding.location.searching"),
          noResults: t("onboarding.location.noResults"),
        }}
        query={places.query}
        onQueryChange={places.setQuery}
        suggestions={places.suggestions}
        searching={places.searching}
        onSelect={(place) => {
          set(names.street, place.street ?? "", true);
          set(names.postalCode, place.postalCode ?? "");
          set(names.city, place.city, true);
          onPick({ latitude: place.latitude, longitude: place.longitude });
          places.setQuery("");
        }}
        error={places.error ? problemMessage(t, places.error) : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        {field(names.street, t("onboarding.venue.address.street"), "street-address")}
        {field(names.postalCode, t("onboarding.venue.address.postalCode"), "postal-code")}
      </div>
      {field(names.city, t("onboarding.venue.address.city"), "address-level2")}
    </>
  );
}
