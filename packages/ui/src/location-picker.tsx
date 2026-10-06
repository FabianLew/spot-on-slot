"use client";

import { CircleAlert, LocateFixed } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Input } from "./input";
import { Label } from "./label";

export interface LocationPickerLabels {
  search: string;
  placeholder: string;
  useDevice: string;
  locating: string;
  searching: string;
  noResults: string;
}

/**
 * City or address field with suggestions (ARIA combobox) and a "use my location" button. Searching, geolocation
 * and saving are the caller's job: it passes the query, the suggestions for it and reacts to the choice.
 */
export function LocationPicker<T extends { label: string }>({
  labels,
  query,
  onQueryChange,
  suggestions,
  searching = false,
  onSelect,
  onUseDevice,
  locating = false,
  error,
  minQueryLength = 3,
  className,
}: {
  labels: LocationPickerLabels;
  query: string;
  onQueryChange: (query: string) => void;
  suggestions: T[];
  searching?: boolean;
  onSelect: (place: T) => void;
  /** Omit to hide the "use my location" button (e.g. for a business address). */
  onUseDevice?: () => void;
  locating?: boolean;
  error?: string;
  minQueryLength?: number;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typedEnough = query.trim().length >= minQueryLength;
  const expanded = open && typedEnough && (suggestions.length > 0 || !searching);
  const optionId = (index: number) => `${id}-option-${index}`;

  function choose(place: T) {
    setOpen(false);
    setActive(-1);
    onSelect(place);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && expanded && active >= 0 && suggestions[active]) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-input`}>{labels.search}</Label>
        <div className="relative">
          <Input
            id={`${id}-input`}
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            placeholder={labels.placeholder}
            value={query}
            onChange={(event) => {
              setOpen(true);
              setActive(-1);
              onQueryChange(event.target.value);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
          />
          {expanded && (
            <ul
              id={listId}
              role="listbox"
              aria-label={labels.search}
              className="absolute inset-x-0 top-full z-20 mt-1 border-2 border-border bg-card shadow-lg"
            >
              {suggestions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">{labels.noResults}</li>
              ) : (
                suggestions.map((place, index) => (
                  <li
                    key={`${index}-${place.label}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    // mousedown, not click: the input's blur would close the list first.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(place);
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "cursor-pointer px-3 py-2 text-sm",
                      index === active && "bg-primary text-primary-foreground",
                    )}
                  >
                    {place.label}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        {open && typedEnough && searching && (
          <p role="status" className="text-xs text-muted-foreground">
            {labels.searching}
          </p>
        )}
      </div>
      {onUseDevice && (
        <Button type="button" variant="outline" onClick={onUseDevice} disabled={locating} className="self-start">
          <LocateFixed className="size-4" aria-hidden="true" />
          {locating ? labels.locating : labels.useDevice}
        </Button>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
