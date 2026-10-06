"use client";

import { useId } from "react";
import { cn } from "./cn";

/**
 * Self-assessed skill from 1 to 10 as a range input; 0 means "not set" and shows {@code unsetLabel}. The readout
 * repeats the ten pixel cells of `SkillMeter`, so editing looks like the profile.
 */
export function SkillSlider({
  label,
  value,
  onChange,
  unsetLabel,
  max = 10,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unsetLabel: string;
  max?: number;
  className?: string;
}) {
  const id = useId();
  const readout = value > 0 ? `${value}/${max}` : unsetLabel;
  return (
    <div className={cn("flex flex-col gap-2 text-xs uppercase", className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        <span aria-hidden="true" className="tabular-nums">
          {readout}
        </span>
      </div>
      <span aria-hidden="true" className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn("h-3 flex-1 border border-highlight", i < value ? "bg-highlight" : "bg-transparent")}
          />
        ))}
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        aria-valuetext={readout}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
