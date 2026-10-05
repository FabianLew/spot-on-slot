"use client";

import { useId } from "react";

export type Choice = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  select: (value: string) => void;
};

export function RadioList({ choice }: { choice: Choice }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        {choice.label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {choice.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice.value === option.value}
            onClick={() => choice.select(option.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:border-primary aria-checked:bg-accent aria-checked:font-medium"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
