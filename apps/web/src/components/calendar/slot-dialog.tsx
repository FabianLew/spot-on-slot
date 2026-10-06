"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Checkbox,
  ChoiceChips,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
  Textarea,
  toast,
  translateFormError,
} from "@spot-on-slot/ui";
import { showServerError } from "@/components/auth/server-error";
import { api } from "@/lib/api";
import { AVAILABILITY, hhmm, type Occurrence, type Rule } from "./queries";
import { addDays, instantAt, ISO_WEEKDAYS, local, weekdayIndex, type Weekday } from "./warsaw-time";

/** What the dialog edits: a new entry on a day, an existing single slot, or a weekly rule. */
export type SlotDialogTarget =
  | { kind: "new"; day: string }
  | { kind: "slot"; slot: Occurrence }
  | { kind: "rule"; rule: Rule };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z
  .object({
    date: z.string().min(1, "validation.required"),
    from: z.string().regex(TIME, "validation.time"),
    to: z.string().regex(TIME, "validation.time"),
    note: z.string().max(200, "validation.tooLong"),
    repeat: z.boolean(),
    days: z.array(z.enum(ISO_WEEKDAYS)),
    until: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.repeat) return;
    if (values.days.length === 0) ctx.addIssue({ code: "custom", path: ["days"], message: "validation.daysRequired" });
    if (values.until && values.until < values.date) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "validation.untilOrder" });
    }
  });
type Values = z.infer<typeof schema>;

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Length in minutes of `from`–`to`, where an end at or before the start means the next day. */
export function lengthMinutes(from: string, to: string) {
  const diff = minutes(to) - minutes(from);
  return diff > 0 ? diff : diff + 24 * 60;
}

function initialValues(target: SlotDialogTarget): Values {
  if (target.kind === "rule") {
    const { rule } = target;
    const start = hhmm(rule.startTime);
    const end = (minutes(start) + rule.durationMinutes) % (24 * 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: rule.validFrom,
      from: start,
      to: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
      note: rule.note ?? "",
      repeat: true,
      days: rule.days,
      until: rule.validUntil ?? "",
    };
  }
  if (target.kind === "slot") {
    const start = local(target.slot.startsAt);
    return {
      date: start.day,
      from: start.time,
      to: local(target.slot.endsAt).time,
      note: target.slot.note ?? "",
      repeat: false,
      days: [],
      until: "",
    };
  }
  return {
    date: target.day,
    from: "21:00",
    to: "03:00",
    note: "",
    repeat: false,
    days: [ISO_WEEKDAYS[weekdayIndex(target.day)]!],
    until: "",
  };
}

/** Adds or edits free time: one slot, or (with "Powtarzaj co tydzień") a weekly rule. */
export function SlotDialog({ target, onClose }: { target: SlotDialogTarget | null; onClose: () => void }) {
  const t = useTranslations();
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <DialogContent
          closeLabel={t("common.close")}
          className="max-h-[90vh] overflow-y-auto rounded-none border-2 border-border"
        >
          <SlotForm key={JSON.stringify(target)} target={target} onDone={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function SlotForm({ target, onDone }: { target: SlotDialogTarget; onDone: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initialValues(target) });
  const [date, from, to, repeat] = useWatch({ control: form.control, name: ["date", "from", "to", "repeat"] });
  const fixedKind = target.kind !== "new";

  // A new entry repeats on the weekday of its date until the artist picks days.
  const dirtyDays = form.formState.dirtyFields.days;
  useEffect(() => {
    if (target.kind === "new" && !dirtyDays && date) {
      form.setValue("days", [ISO_WEEKDAYS[weekdayIndex(date)]!]);
    }
  }, [date, dirtyDays, form, target.kind]);

  const valid = TIME.test(from) && TIME.test(to);
  const length = valid ? lengthMinutes(from, to) : 0;
  const nextDay = valid && minutes(to) <= minutes(from);
  const hours = Math.floor(length / 60);
  const rest = length % 60;

  async function onSubmit(values: Values) {
    const note = values.note.trim() || undefined;
    try {
      if (values.repeat) {
        const body = {
          days: [...values.days].sort((a, b) => ISO_WEEKDAYS.indexOf(a) - ISO_WEEKDAYS.indexOf(b)),
          startTime: values.from,
          durationMinutes: lengthMinutes(values.from, values.to),
          validFrom: values.date,
          validUntil: values.until || undefined,
          note,
        };
        unwrap(
          target.kind === "rule"
            ? await api.PUT("/api/v1/availability/me/rules/{id}", { params: { path: { id: target.rule.id } }, body })
            : await api.POST("/api/v1/availability/me/rules", { body }),
        );
      } else {
        const endDay = minutes(values.to) <= minutes(values.from) ? addDays(values.date, 1) : values.date;
        const body = {
          startsAt: instantAt(values.date, values.from).toISOString(),
          endsAt: instantAt(endDay, values.to).toISOString(),
          note,
        };
        unwrap(
          target.kind === "slot"
            ? await api.PUT("/api/v1/availability/me/slots/{id}", {
                params: { path: { id: target.slot.slotId! } },
                body,
              })
            : await api.POST("/api/v1/availability/me/slots", { body }),
        );
      }
      await queryClient.invalidateQueries({ queryKey: AVAILABILITY });
      toast.success(t(values.repeat ? "calendar.dialog.savedRule" : "calendar.dialog.saved"));
      onDone();
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  const title =
    target.kind === "rule"
      ? t("calendar.dialog.editRule")
      : target.kind === "slot"
        ? t("calendar.dialog.editSlot")
        : t("calendar.dialog.add");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="uppercase">{title}</DialogTitle>
        <DialogDescription>
          {target.kind === "rule" ? t("calendar.dialog.ruleHint") : t("calendar.dialog.hint")}
        </DialogDescription>
      </DialogHeader>
      <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{repeat ? t("calendar.dialog.validFrom") : t("calendar.dialog.date")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar.dialog.from")}</FormLabel>
                  <FormControl>
                    <Input type="time" step={300} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar.dialog.to")}</FormLabel>
                  <FormControl>
                    <Input type="time" step={300} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {valid && (
            <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
              {t("calendar.dialog.length", { hours, minutes: rest })}
              {nextDay && ` · ${t("calendar.dialog.nextDay")}`}
            </p>
          )}
          {!fixedKind && (
            <FormField
              control={form.control}
              name="repeat"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  </FormControl>
                  <FormLabel className="m-0">{t("calendar.dialog.repeat")}</FormLabel>
                </FormItem>
              )}
            />
          )}
          {repeat && (
            <>
              <FormField
                control={form.control}
                name="days"
                render={({ field, fieldState }) => (
                  <ChoiceChips<Weekday>
                    legend={t("calendar.dialog.days")}
                    options={ISO_WEEKDAYS.map((day) => ({ value: day, label: t(`calendar.weekdays.${day}`) }))}
                    value={field.value}
                    onChange={field.onChange}
                    error={
                      fieldState.error?.message ? t(fieldState.error.message as "validation.daysRequired") : undefined
                    }
                  />
                )}
              />
              <FormField
                control={form.control}
                name="until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("calendar.dialog.until")}</FormLabel>
                    <FormControl>
                      <Input type="date" min={date} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("calendar.dialog.note")}</FormLabel>
                <FormControl>
                  <Textarea rows={2} maxLength={200} placeholder={t("calendar.dialog.notePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormRootError />
          <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("calendar.dialog.saving") : t("calendar.dialog.save")}
          </Button>
        </form>
      </Form>
    </>
  );
}
