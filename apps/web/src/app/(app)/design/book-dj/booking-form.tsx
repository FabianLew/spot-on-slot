"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  MonthCalendar,
  Panel,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { parseDay } from "@/components/design/sample-data";
import { bookingSchema, type BookingValues } from "./booking-schema";

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Weekday names, Monday first: 2 November 2026 is a Monday.
const MONDAY = new Date(2026, 10, 2);

export function BookingForm({ openDates }: { openDates: readonly string[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const first = parseDay(openDates[0]!);
  const [month, setMonth] = useState(new Date(first.getFullYear(), first.getMonth(), 1));
  const open = new Set(openDates);
  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { venueName: "", location: "", date: openDates[1] ?? "", time: "" },
  });
  const date = useWatch({ control: form.control, name: "date" });

  // Formatting a local Date: pass the browser zone so the calendar shows the day it was built from.
  const local = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const labels = {
    weekdays: Array.from({ length: 7 }, (_, i) =>
      format.dateTime(new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() + i), {
        weekday: "short",
        ...local,
      }),
    ),
    title: format.dateTime(month, { month: "long", year: "numeric", ...local }),
    previousMonth: t("design.book.previousMonth"),
    nextMonth: t("design.book.nextMonth"),
    available: t("design.book.available"),
    selected: t("design.book.selected"),
    unavailable: t("design.book.unavailable"),
    dayLabel: (d: Date) => format.dateTime(d, { day: "numeric", month: "long", year: "numeric", ...local }),
  };

  function onSubmit() {
    toast.success(`${t("design.book.sent")} ${t("design.previewNotice")}`);
    form.reset();
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4 md:grid-cols-2 md:items-start">
        <Panel aria-label={t("design.book.calendar")}>
          <MonthCalendar
            month={month}
            labels={labels}
            dayState={(d) => (open.has(toDay(d)) ? "available" : "unavailable")}
            selected={date ? parseDay(date) : undefined}
            onSelect={(d) => form.setValue("date", toDay(d), { shouldValidate: true })}
            onMonthChange={setMonth}
          />
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title={t("design.book.eventDetails")}>
            <div className="grid gap-4">
              {(["venueName", "location"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className="sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                      <FormLabel className="text-xs uppercase">{t(`design.book.${name}`)}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage className="sm:col-start-2" />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                    <FormLabel className="text-xs uppercase">{t("design.book.date")}</FormLabel>
                    <FormControl>
                      <Input
                        readOnly
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        placeholder={t("design.book.datePlaceholder")}
                        value={
                          field.value
                            ? format.dateTime(parseDay(field.value), { dateStyle: "long", ...local })
                            : ""
                        }
                      />
                    </FormControl>
                    <FormMessage className="sm:col-start-2" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem className="sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                    <FormLabel className="text-xs uppercase">{t("design.book.time")}</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage className="sm:col-start-2" />
                  </FormItem>
                )}
              />
            </div>
          </Panel>
          <Button type="submit" size="lg" className="min-h-14 h-auto justify-between whitespace-normal py-3 text-left text-base">
            <span>{t("design.book.send")}</span>
            <span aria-hidden="true">→</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
