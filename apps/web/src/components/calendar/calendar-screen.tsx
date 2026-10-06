"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Megaphone, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, MonthCalendar, PageHeader, Panel, Tag, toast } from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { ListingDialog, type ListingDialogTarget } from "@/components/listings/listing-dialog";
import { announcing, LISTINGS, useArtistListings } from "@/components/listings/queries";
import { useArtistProfile } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { AVAILABILITY, dayRange, entriesByDay, hhmm, useCalendar, useRules, type Entry, type Rule } from "./queries";
import { SlotDialog, type SlotDialogTarget } from "./slot-dialog";
import {
  addDays,
  dayDate,
  daysInMonth,
  ISO_WEEKDAYS,
  local,
  startOfDay,
  startOfMonth,
  startOfWeek,
  today,
} from "./warsaw-time";

type View = "month" | "week";

/** The "Kalendarz" tab: an artist's free time by month or week, with the weekly rules underneath. */
export function CalendarScreen() {
  const t = useTranslations("calendar");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      {role === "ARTIST" ? (
        <ArtistCalendar />
      ) : (
        <Panel>
          <p className="text-sm">{t("otherRole")}</p>
        </Panel>
      )}
    </section>
  );
}

function ArtistCalendar() {
  const t = useTranslations("calendar");
  const profile = useArtistProfile();
  if (profile.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  if (!profile.data) {
    return (
      <Panel>
        <p className="text-sm">{t("noProfile")}</p>
        <Button asChild className="self-start">
          <Link href="/onboarding">{t("createProfile")}</Link>
        </Button>
      </Panel>
    );
  }
  return <CalendarBody />;
}

/** "Ogłoś" on free time, for artists whose profile is published (listings need one). */
type Announce = { announced: (entry: Entry) => boolean; onAnnounce: (entry: Entry) => void };

function CalendarBody() {
  const t = useTranslations("calendar");
  const [view, setView] = useState<View>("month");
  const [day, setDay] = useState(() => today());
  const [dialog, setDialog] = useState<SlotDialogTarget | null>(null);
  const [listing, setListing] = useState<ListingDialogTarget | null>(null);
  const profile = useArtistProfile().data;
  const published = profile?.published === true;
  const listings = useArtistListings("active", published);
  const announce: Announce | undefined = published
    ? {
        announced: (entry) => announcing(listings.data, entry) != null,
        onAnnounce: (entry) => setListing({ mode: "new", term: entry }),
      }
    : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("view")} className="flex">
          {(["month", "week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={
                "-mr-0.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (view === option ? "border-primary bg-primary text-primary-foreground" : "bg-field hover:bg-muted")
              }
            >
              {t(`views.${option}`)}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setDay(today())}>
          {t("today")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={() => setDialog({ kind: "new", day: future(day) })}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      </div>
      {view === "month" ? (
        <MonthView day={day} onDay={setDay} onEdit={setDialog} announce={announce} />
      ) : (
        <WeekView day={day} onDay={setDay} onEdit={setDialog} announce={announce} />
      )}
      <RulesPanel onEdit={(rule) => setDialog({ kind: "rule", rule })} />
      <SlotDialog target={dialog} onClose={() => setDialog(null)} />
      {profile && (
        <ListingDialog
          target={listing}
          author={{
            kind: "ARTIST_AVAILABLE",
            genres: profile.genres,
            priceFrom: profile.rate?.from,
            priceTo: profile.rate?.to,
            travelRadiusKm: profile.travelRadiusKm,
          }}
          onClose={() => setListing(null)}
        />
      )}
    </>
  );
}

/** Adding starts on the chosen day, or today when that day is over. */
const future = (day: string) => (day < today() ? today() : day);

function useEntries(firstDay: string, count: number) {
  const days = dayRange(firstDay, count);
  const calendar = useCalendar(startOfDay(firstDay), startOfDay(addDays(firstDay, count)));
  const rules = useRules();
  const byDay = calendar.data && rules.data ? entriesByDay(calendar.data, rules.data, days) : undefined;
  return { days, byDay, calendar, rules };
}

const isFree = (entry: Entry) => entry.status === "FREE" && !entry.skipped;

function MonthView({
  day,
  onDay,
  onEdit,
  announce,
}: {
  day: string;
  onDay: (day: string) => void;
  onEdit: (target: SlotDialogTarget) => void;
  announce?: Announce;
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const first = startOfMonth(day);
  const { byDay, calendar, rules } = useEntries(first, daysInMonth(first));
  const toDay = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [year, month] = first.split("-").map(Number) as [number, number];
  const failed = calendar.error ?? rules.error;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <Panel aria-busy={!byDay}>
        <MonthCalendar
          month={new Date(year, month - 1, 1)}
          selectAny
          selected={new Date(year, month - 1, Number(day.slice(8, 10)))}
          labels={{
            weekdays: ISO_WEEKDAYS.map((name) => t(`weekdaysShort.${name}`)),
            title: format.dateTime(dayDate(first), { month: "long", year: "numeric" }),
            previousMonth: t("previousMonth"),
            nextMonth: t("nextMonth"),
            available: t("states.free"),
            selected: t("states.selected"),
            unavailable: t("states.empty"),
            booked: t("states.booked"),
            dayLabel: (date) =>
              format.dateTime(dayDate(toDay(date)), { day: "numeric", month: "long", year: "numeric" }),
          }}
          dayState={(date) => (byDay?.get(toDay(date))?.some(isFree) ? "available" : "unavailable")}
          isBooked={(date) => byDay?.get(toDay(date))?.some((entry) => entry.status === "BOOKED") ?? false}
          onSelect={(date) => onDay(toDay(date))}
          onMonthChange={(next) => onDay(startOfMonth(toDay(next)))}
        />
      </Panel>
      {failed ? (
        <ApiErrorState
          error={failed}
          onRetry={() => {
            void calendar.refetch();
            void rules.refetch();
          }}
        />
      ) : (
        <Panel
          title={format.dateTime(dayDate(day), { weekday: "long", day: "numeric", month: "long" })}
          headingLevel={2}
        >
          <DayEntries day={day} entries={byDay?.get(day)} onEdit={onEdit} announce={announce} />
        </Panel>
      )}
    </div>
  );
}

function WeekView({
  day,
  onDay,
  onEdit,
  announce,
}: {
  day: string;
  onDay: (day: string) => void;
  onEdit: (target: SlotDialogTarget) => void;
  announce?: Announce;
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const monday = startOfWeek(day);
  const { days, byDay, calendar, rules } = useEntries(monday, 7);
  const failed = calendar.error ?? rules.error;
  const range = format.dateTimeRange(dayDate(monday), dayDate(addDays(monday, 6)), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Panel aria-busy={!byDay}>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onDay(addDays(monday, -7))}
          aria-label={t("previousWeek")}
          className="font-display px-2 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ‹
        </button>
        <h2 className="font-display min-w-48 text-center text-lg leading-none" aria-live="polite">
          {range}
        </h2>
        <button
          type="button"
          onClick={() => onDay(addDays(monday, 7))}
          aria-label={t("nextWeek")}
          className="font-display px-2 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ›
        </button>
      </div>
      {failed ? (
        <ApiErrorState
          error={failed}
          onRetry={() => {
            void calendar.refetch();
            void rules.refetch();
          }}
        />
      ) : (
        <ol className="grid gap-2 md:grid-cols-7">
          {days.map((date) => {
            const current = date === today();
            return (
              <li
                key={date}
                aria-label={format.dateTime(dayDate(date), { weekday: "long", day: "numeric", month: "long" })}
                className={
                  "flex min-w-0 flex-col gap-2 border-2 p-2 " +
                  (date === day ? "border-primary" : "border-border") +
                  (current ? " bg-muted" : "")
                }
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onDay(date)}
                    className="text-left text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {format.dateTime(dayDate(date), { weekday: "short", day: "numeric", month: "numeric" })}
                  </button>
                  {date >= today() && (
                    <button
                      type="button"
                      aria-label={t("addOn", {
                        day: format.dateTime(dayDate(date), { day: "numeric", month: "long" }),
                      })}
                      onClick={() => onEdit({ kind: "new", day: date })}
                      className="border-2 border-border p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <DayEntries day={date} entries={byDay?.get(date)} onEdit={onEdit} announce={announce} compact />
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/** One day's entries with their actions; started and booked time is read-only. */
function DayEntries({
  day,
  entries,
  onEdit,
  announce,
  compact = false,
}: {
  day: string;
  entries: Entry[] | undefined;
  onEdit: (target: SlotDialogTarget) => void;
  announce?: Announce;
  compact?: boolean;
}) {
  const t = useTranslations("calendar");
  const tl = useTranslations("listings");
  const queryClient = useQueryClient();
  const rules = useRules();
  // Removing free time can expire listings announcing it.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: AVAILABILITY }),
      queryClient.invalidateQueries({ queryKey: LISTINGS }),
    ]);

  const removeSlot = useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE("/api/v1/availability/me/slots/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      toast.success(t("deleted"));
      return refresh();
    },
  });
  const skip = useMutation({
    mutationFn: async ({ ruleId, date, restore }: { ruleId: string; date: string; restore: boolean }) => {
      const options = { params: { path: { id: ruleId, date } } };
      return unwrap(
        restore
          ? await api.PUT("/api/v1/availability/me/rules/{id}/dates/{date}", options)
          : await api.DELETE("/api/v1/availability/me/rules/{id}/dates/{date}", options),
      );
    },
    onSuccess: (_, { restore }) => {
      toast.success(t(restore ? "restored" : "skipped"));
      return refresh();
    },
  });

  if (!entries) return <p className="text-xs text-muted-foreground">{t("loading")}</p>;
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">{compact ? t("emptyShort") : t("emptyDay")}</p>;
  }
  const now = new Date();
  const busy = removeSlot.isPending || skip.isPending;

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const start = local(entry.startsAt);
        const end = local(entry.endsAt);
        const started = new Date(entry.startsAt) <= now;
        const booked = entry.status === "BOOKED";
        const rule = entry.ruleId ? rules.data?.find((r) => r.id === entry.ruleId) : undefined;
        const time = `${start.time}–${end.time}`;
        const free = !booked && !entry.skipped && !started;
        const announced = free && announce?.announced(entry);
        return (
          <li
            key={`${entry.startsAt}-${entry.slotId ?? entry.ruleId}`}
            data-status={entry.skipped ? "skipped" : entry.status}
            className={
              "flex flex-col gap-1.5 border-2 p-2 " +
              (entry.skipped
                ? "border-dashed border-border text-muted-foreground"
                : booked
                  ? "border-primary"
                  : "border-border bg-highlight text-highlight-foreground")
            }
          >
            <p
              className={
                (compact ? "text-xs " : "text-sm ") +
                "flex flex-wrap items-baseline gap-x-1 font-bold tabular-nums " +
                (entry.skipped ? "line-through" : "")
              }
            >
              <span className="whitespace-nowrap">{time}</span>
              {end.day !== start.day && (
                <span className="text-[0.625rem] font-normal uppercase" title={t("nextDayShort")}>
                  {compact ? "+1" : t("nextDayShort")}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1">
              {entry.source === "RULE" && <Tag className="bg-transparent text-[0.625rem]">{t("weekly")}</Tag>}
              {booked && (
                <Tag className="border-primary bg-primary text-[0.625rem] text-primary-foreground">
                  <CalendarCheck className="mr-1 size-3" aria-hidden="true" />
                  {t("states.booked")}
                </Tag>
              )}
              {entry.skipped && <Tag className="bg-transparent text-[0.625rem]">{t("skippedTag")}</Tag>}
              {announced && (
                <Tag className="bg-transparent text-[0.625rem]">
                  <Megaphone className="mr-1 size-3" aria-hidden="true" />
                  {tl("announced")}
                </Tag>
              )}
            </div>
            {entry.note && !compact && <p className="text-xs break-words">{entry.note}</p>}
            {booked && !compact && <p className="text-xs text-muted-foreground">{t("bookedHint")}</p>}
            {!started && !booked && (
              <div className="flex flex-wrap gap-1">
                {free && announce && !announced && (
                  <IconButton
                    label={tl("announceAt", { time })}
                    text={compact ? undefined : tl("announce")}
                    icon={<Megaphone className="size-3.5" aria-hidden="true" />}
                    onClick={() => announce.onAnnounce(entry)}
                  />
                )}
                {entry.source === "SLOT" && entry.slotId && (
                  <>
                    <IconButton
                      label={t("editAt", { time })}
                      text={compact ? undefined : t("edit")}
                      icon={<Pencil className="size-3.5" aria-hidden="true" />}
                      onClick={() => onEdit({ kind: "slot", slot: entry })}
                    />
                    <IconButton
                      label={t("deleteAt", { time })}
                      text={compact ? undefined : t("delete")}
                      icon={<Trash2 className="size-3.5" aria-hidden="true" />}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(t("deleteConfirm", { time }))) removeSlot.mutate(entry.slotId!);
                      }}
                    />
                  </>
                )}
                {entry.source === "RULE" && entry.ruleId && entry.date && (
                  <>
                    {entry.skipped ? (
                      <IconButton
                        label={t("restoreAt", { time })}
                        text={compact ? undefined : t("restore")}
                        icon={<RotateCcw className="size-3.5" aria-hidden="true" />}
                        disabled={busy}
                        onClick={() => skip.mutate({ ruleId: entry.ruleId!, date: entry.date!, restore: true })}
                      />
                    ) : (
                      <IconButton
                        label={t("skipAt", { time })}
                        text={compact ? undefined : t("skip")}
                        icon={<X className="size-3.5" aria-hidden="true" />}
                        disabled={busy}
                        onClick={() => skip.mutate({ ruleId: entry.ruleId!, date: entry.date!, restore: false })}
                      />
                    )}
                    {rule && !compact && (
                      <IconButton
                        label={t("editRuleAt", { time })}
                        text={t("editRule")}
                        icon={<Pencil className="size-3.5" aria-hidden="true" />}
                        onClick={() => onEdit({ kind: "rule", rule })}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
      {!compact && day >= today() && (
        <li>
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit({ kind: "new", day })}>
            <Plus className="size-4" aria-hidden="true" />
            {t("addHere")}
          </Button>
        </li>
      )}
    </ul>
  );
}

function IconButton({
  label,
  text,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  text?: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 border-2 border-border bg-card px-1.5 py-1 text-[0.625rem] font-bold uppercase text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {icon}
      {text}
    </button>
  );
}

/** "Stałe terminy": the weekly rules, edited or removed as a whole. */
function RulesPanel({ onEdit }: { onEdit: (rule: Rule) => void }) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const rules = useRules();
  const remove = useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE("/api/v1/availability/me/rules/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      toast.success(t("rules.deleted"));
      return queryClient.invalidateQueries({ queryKey: AVAILABILITY });
    },
  });

  const date = (day: string) => format.dateTime(dayDate(day), { day: "numeric", month: "short", year: "numeric" });

  return (
    <Panel title={t("rules.title")} headingLevel={2}>
      {rules.isPending ? (
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      ) : rules.isError ? (
        <ApiErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : rules.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("rules.none")}</p>
      ) : (
        <ul aria-label={t("rules.title")} className="flex flex-col divide-y-2 divide-border">
          {rules.data.map((rule) => {
            const start = hhmm(rule.startTime);
            const endMinutes = (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + rule.durationMinutes) % 1440;
            const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
            const days = rule.days.map((name) => t(`weekdaysShort.${name}`)).join(", ");
            const summary = `${days} · ${start}–${end}`;
            return (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-bold uppercase">{summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.validUntil
                      ? t("rules.between", { from: date(rule.validFrom), until: date(rule.validUntil) })
                      : t("rules.since", { from: date(rule.validFrom) })}
                    {rule.note && ` · ${rule.note}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <IconButton
                    label={t("rules.editLabel", { rule: summary })}
                    text={t("edit")}
                    icon={<Pencil className="size-3.5" aria-hidden="true" />}
                    onClick={() => onEdit(rule)}
                  />
                  <IconButton
                    label={t("rules.deleteLabel", { rule: summary })}
                    text={t("delete")}
                    icon={<Trash2 className="size-3.5" aria-hidden="true" />}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t("rules.deleteConfirm", { rule: summary }))) remove.mutate(rule.id);
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
