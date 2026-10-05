"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { cn } from "./cn";

export type DayState = "available" | "unavailable";

export interface MonthCalendarLabels {
  /** Seven short weekday names, Monday first. */
  weekdays: readonly string[];
  /** Visible month title, e.g. "październik 2026". */
  title: string;
  previousMonth: string;
  nextMonth: string;
  available: string;
  selected: string;
  unavailable: string;
  /** Accessible name of a day button, e.g. "18 października 2026". */
  dayLabel: (date: Date) => string;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Days of `month` (any date in it) as a Monday-first grid with leading blanks. */
export function monthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
}

/**
 * Month grid from the "Book DJ" mockup: available days are yellow and selectable, the selected
 * day is red, other days are inert. State is shown by colour, an inner frame and the accessible name.
 */
export function MonthCalendar({
  month,
  labels,
  dayState,
  selected,
  onSelect,
  onMonthChange,
  className,
}: {
  month: Date;
  labels: MonthCalendarLabels;
  dayState: (date: Date) => DayState;
  selected?: Date;
  onSelect: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  className?: string;
}) {
  const cells = monthGrid(month);
  const days = cells.filter((d): d is Date => d !== null);
  const selectable = days.filter((d) => dayState(d) === "available");
  const initial = selected && days.some((d) => sameDay(d, selected)) ? selected : selectable[0];
  const [focusDay, setFocusDay] = useState<number | undefined>(initial?.getDate());
  const refs = useRef(new Map<number, HTMLButtonElement>());

  const tabStop =
    focusDay !== undefined && selectable.some((d) => d.getDate() === focusDay) ? focusDay : initial?.getDate();

  function move(event: KeyboardEvent, from: number) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    for (let day = from + step; day >= 1 && day <= days.length; day += step) {
      const date = days[day - 1]!;
      if (dayState(date) === "available") {
        setFocusDay(day);
        refs.current.get(day)?.focus();
        return;
      }
    }
  }

  const shift = (delta: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={labels.previousMonth}
          className="font-display px-2 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹
        </button>
        <h3 className="font-display min-w-48 text-center text-lg leading-none" aria-live="polite">
          {labels.title}
        </h3>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={labels.nextMonth}
          className="font-display px-2 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ›
        </button>
      </div>
      <div role="group" aria-label={labels.title} className="grid grid-cols-7">
        {labels.weekdays.map((name) => (
          <span key={name} aria-hidden="true" className="pb-2 text-center text-[0.625rem] uppercase text-muted-foreground">
            {name}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} aria-hidden="true" />;
          const day = date.getDate();
          const isSelected = selected !== undefined && sameDay(date, selected);
          const available = dayState(date) === "available";
          const status = isSelected ? labels.selected : available ? labels.available : labels.unavailable;
          return (
            <button
              key={day}
              ref={(el) => {
                if (el) refs.current.set(day, el);
                else refs.current.delete(day);
              }}
              type="button"
              disabled={!available}
              aria-pressed={available ? isSelected : undefined}
              aria-label={`${labels.dayLabel(date)}, ${status}`}
              tabIndex={available && day === tabStop ? 0 : -1}
              onClick={() => {
                setFocusDay(day);
                onSelect(date);
              }}
              onKeyDown={(event) => move(event, day)}
              data-state={isSelected ? "selected" : available ? "available" : "unavailable"}
              className={cn(
                "-mr-0.5 -mb-0.5 flex aspect-square items-center justify-center border-2 border-border text-xs font-bold tabular-nums focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:aspect-[5/4]",
                isSelected && "bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_var(--card)]",
                !isSelected && available && "bg-highlight text-highlight-foreground hover:opacity-90",
                !available && "cursor-default bg-field text-muted-foreground",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] uppercase text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 border border-border bg-highlight" />
          {labels.available}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 border border-border bg-primary" />
          {labels.selected}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 border border-border bg-field" />
          {labels.unavailable}
        </li>
      </ul>
    </div>
  );
}
