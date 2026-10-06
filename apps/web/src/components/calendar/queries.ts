"use client";

import { unwrap, type ApiSchemas } from "@spot-on-slot/api-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { addDays, instantAt, local } from "./warsaw-time";

export type Occurrence = ApiSchemas["OccurrenceResponse"];
export type Rule = ApiSchemas["RuleResponse"];
export type SlotRequest = ApiSchemas["SlotRequest"];
export type RuleRequest = ApiSchemas["RuleRequest"];

/** What the day lists show: real occurrences plus skipped rule dates, which can be restored. */
export type Entry = Occurrence & { skipped?: boolean };

export const AVAILABILITY = ["availability"] as const;
export const RULES = ["availability", "rules"] as const;

/** The artist's occurrences overlapping `[from, to)`. */
export function useCalendar(from: Date, to: Date, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...AVAILABILITY, "calendar", from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Occurrence[]> =>
      unwrap(
        await api.GET("/api/v1/availability/me", {
          params: { query: { from: from.toISOString(), to: to.toISOString() } },
        }),
      ),
  });
}

export function useRules() {
  return useQuery({
    queryKey: RULES,
    queryFn: async (): Promise<Rule[]> => unwrap(await api.GET("/api/v1/availability/me/rules")),
  });
}

/** "21:00:00" or "21:00" as "21:00". */
export const hhmm = (time: string) => time.slice(0, 5);

/**
 * Occurrences grouped by the local day they start on, with each rule's skipped dates in `days` added as
 * crossed-out entries (unless a booking took that time, which is what skipped it).
 */
export function entriesByDay(occurrences: Occurrence[], rules: Rule[], days: string[]): Map<string, Entry[]> {
  const byDay = new Map<string, Entry[]>(days.map((day) => [day, []]));
  for (const occurrence of occurrences) byDay.get(local(occurrence.startsAt).day)?.push(occurrence);
  const booked = occurrences.filter((o) => o.status === "BOOKED");
  for (const rule of rules) {
    for (const date of rule.skippedDates) {
      const list = byDay.get(date);
      if (!list) continue;
      const startsAt = instantAt(date, hhmm(rule.startTime));
      const endsAt = new Date(startsAt.getTime() + rule.durationMinutes * 60_000);
      const taken = booked.some((o) => new Date(o.startsAt) < endsAt && new Date(o.endsAt) > startsAt);
      if (taken) continue;
      list.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: "FREE",
        note: rule.note,
        source: "RULE",
        ruleId: rule.id,
        date,
        skipped: true,
      });
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return byDay;
}

/** `count` consecutive days from `first`. */
export const dayRange = (first: string, count: number) => Array.from({ length: count }, (_, i) => addDays(first, i));
