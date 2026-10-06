import type { ApiSchemas } from "@spot-on-slot/api-client";
import { useFormatter, useTranslations } from "next-intl";
import { Panel } from "@spot-on-slot/ui";
import { local } from "./warsaw-time";

export type FreeTime = Pick<ApiSchemas["PublicOccurrenceResponse"], "startsAt" | "endsAt" | "status">;

/** How far ahead the profile looks for free time, and how many days it shows. */
export const NEXT_FREE_DAYS = 60;
export const NEXT_FREE_MAX = 6;

/** The first free time of each upcoming day (in Warsaw), soonest first, at most `max` days. */
export function nextFree(occurrences: FreeTime[], now: Date, max = NEXT_FREE_MAX): FreeTime[] {
  const seen = new Set<string>();
  return [...occurrences]
    .filter((o) => o.status === "FREE" && new Date(o.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .filter((o) => {
      const day = local(o.startsAt).day;
      if (seen.has(day)) return false;
      seen.add(day);
      return true;
    })
    .slice(0, max);
}

/** "Najbliższe wolne terminy" from the "DJ profile" mockup: date chips, no booking yet (W9). */
export function NextFreeSlots({ occurrences, now }: { occurrences: FreeTime[]; now: Date }) {
  const t = useTranslations("artistProfile.view");
  const format = useFormatter();
  const coming = nextFree(occurrences, now);
  return (
    <Panel title={t("nextSlots")} headingLevel={3}>
      {coming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {coming.map((slot) => (
            <li
              key={slot.startsAt}
              className="flex flex-col gap-1 border-2 border-border bg-highlight px-2.5 py-2 text-xs font-bold uppercase leading-none text-highlight-foreground"
            >
              <span>{format.dateTime(new Date(slot.startsAt), { day: "2-digit", month: "short" })}</span>
              <span className="text-[0.625rem] tabular-nums">{local(slot.startsAt).time}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
