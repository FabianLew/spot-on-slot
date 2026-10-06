"use client";

import { CircleAlert, X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "./cn";
import { Input } from "./input";

export interface TagInputLabels {
  label: string;
  placeholder?: string;
  hint?: string;
  /** Accessible name of a tag's remove button, e.g. `Usuń „vinyl”`. */
  remove: (tag: string) => string;
}

/**
 * Free-form tags: type and press Enter (or a comma) to add, Backspace in an empty field removes the last one.
 * Duplicates (ignoring case) are skipped; with {@code max} the field is disabled once it is full.
 */
export function TagInput({
  labels,
  value,
  onChange,
  max,
  maxLength,
  error,
  className,
}: {
  labels: TagInputLabels;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  maxLength?: number;
  error?: string;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const full = max !== undefined && value.length >= max;

  function add() {
    const tag = draft.trim().replace(/,+$/, "").trim();
    setDraft("");
    if (!tag || full) return;
    if (value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-bold uppercase">
        {labels.label}
      </label>
      {labels.hint && <p className="-mt-1 text-xs text-muted-foreground">{labels.hint}</p>}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 border-2 border-border bg-field py-1 pl-2.5 pr-1 text-xs font-bold uppercase"
            >
              {tag}
              <button
                type="button"
                aria-label={labels.remove(tag)}
                onClick={() => onChange(value.filter((existing) => existing !== tag))}
                className="p-0.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={labels.placeholder}
        maxLength={maxLength}
        disabled={full}
        aria-invalid={error ? true : undefined}
      />
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
