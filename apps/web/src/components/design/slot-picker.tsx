"use client";

import { useFormatter } from "next-intl";
import { useState } from "react";
import { SlotChip } from "@spot-on-slot/ui";
import { dayInstant } from "./sample-data";

export function SlotPicker({ days, initial }: { days: readonly string[]; initial?: string }) {
  const format = useFormatter();
  const [selected, setSelected] = useState(initial);
  return (
    <ul className="flex flex-wrap gap-2">
      {days.map((day) => (
        <li key={day}>
          <SlotChip selected={day === selected} onClick={() => setSelected(day)}>
            {format.dateTime(dayInstant(day), { day: "2-digit", month: "short" })}
          </SlotChip>
        </li>
      ))}
    </ul>
  );
}
