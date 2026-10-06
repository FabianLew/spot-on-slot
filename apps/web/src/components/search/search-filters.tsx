"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Checkbox, ChoiceChips, Input, Label, cn } from "@spot-on-slot/ui";
import { GENRES, VENUE_TYPES } from "@/components/onboarding/options";
import { KINDS, type ListingKind, type SearchState } from "./search-params";

const BUDGET_DEBOUNCE_MS = 500;

/** The filters of the current tab; every change goes straight to the address. */
export function SearchFilters({
  state,
  onChange,
}: {
  state: SearchState;
  onChange: (patch: Partial<SearchState>) => void;
}) {
  const t = useTranslations();
  const timed = state.tab !== "venues";

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <ChoiceChips
        className="md:col-span-2"
        legend={t("search.filters.genres")}
        options={GENRES.map((genre) => ({ value: genre, label: t(`genres.${genre}`) }))}
        value={state.genres}
        onChange={(genres) => onChange({ genres })}
      />

      {state.tab === "venues" && (
        <ChoiceChips
          className="md:col-span-2"
          legend={t("search.filters.types")}
          options={VENUE_TYPES.map((type) => ({ value: type, label: t(`venueTypes.${type}`) }))}
          value={state.types}
          onChange={(types) => onChange({ types })}
        />
      )}

      {state.tab === "listings" && (
        <fieldset className="flex flex-col gap-2 md:col-span-2">
          <legend className="mb-2 text-sm font-bold uppercase">{t("search.filters.kind")}</legend>
          <div className="flex flex-wrap gap-2">
            {([undefined, ...KINDS] as (ListingKind | undefined)[]).map((kind) => (
              <button
                key={kind ?? "any"}
                type="button"
                aria-pressed={state.kind === kind}
                onClick={() => onChange({ kind })}
                className={cn(
                  "border-2 border-border px-3 py-1.5 text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  state.kind === kind ? "border-primary bg-primary text-primary-foreground" : "bg-field hover:bg-muted",
                )}
              >
                {kind ? t(`listings.kind.${kind}`) : t("search.filters.anyKind")}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {timed && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold uppercase">{t("search.filters.when")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <Label htmlFor="search-date">{t("search.filters.date")}</Label>
              <Input
                id="search-date"
                type="date"
                value={state.date ?? ""}
                onChange={(event) => onChange({ date: event.target.value || undefined })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="search-from">{t("search.filters.from")}</Label>
              <Input
                id="search-from"
                type="time"
                value={state.from ?? ""}
                onChange={(event) => onChange({ from: event.target.value || undefined })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="search-to">{t("search.filters.to")}</Label>
              <Input
                id="search-to"
                type="time"
                value={state.to ?? ""}
                onChange={(event) => onChange({ to: event.target.value || undefined })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {state.tab === "artists" ? t("search.filters.artistTime") : t("search.filters.listingTime")}
          </p>
        </fieldset>
      )}

      {timed && <BudgetField value={state.budget} onChange={(budget) => onChange({ budget })} />}

      {state.tab === "artists" && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="search-travel"
            checked={state.willTravel}
            onCheckedChange={(checked) => onChange({ willTravel: checked === true })}
          />
          <Label htmlFor="search-travel" className="m-0">
            {t("search.filters.willTravel")}
          </Label>
        </div>
      )}
    </div>
  );
}

/** Whole złote, written to the address shortly after typing stops. */
function BudgetField({ value, onChange }: { value?: number; onChange: (budget: number | undefined) => void }) {
  const t = useTranslations("search.filters");
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  // Follow the address when it changes elsewhere (back button, a cleared filter).
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value != null ? String(value) : "");
  }

  useEffect(() => {
    const parsed = draft.trim() === "" ? undefined : Number(draft);
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) return;
    const next = parsed === undefined ? undefined : Math.round(parsed);
    if (next === value) return;
    const timer = setTimeout(() => onChange(next), BUDGET_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="search-budget">{t("budget")}</Label>
      <Input
        id="search-budget"
        type="number"
        inputMode="numeric"
        min={0}
        step={50}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t("budgetHint")}</p>
    </div>
  );
}
