"use client";

import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Button, PageHeader, Panel, toast } from "@spot-on-slot/ui";
import { AVAILABILITY } from "@/components/calendar/queries";
import { local, ZONE } from "@/components/calendar/warsaw-time";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useTermText } from "@/components/listings/listing-time";
import { LISTINGS } from "@/components/listings/queries";
import { api } from "@/lib/api";
import { fallbackMessage } from "@/lib/problem-text";
import { CounterDialog, ReasonDialog } from "./booking-dialogs";
import { otherSide, StatusTag, useAmountText, useExpiresText } from "./booking-text";
import { BOOKINGS, useBooking, type Booking, type BookingStep } from "./queries";

/** `/bookings/[id]`: the current terms, the actions the viewer's side has now, and the history. */
export function BookingDetail({ id }: { id: string }) {
  const t = useTranslations("bookings.detail");
  const booking = useBooking(id);

  return (
    <section className="flex flex-col gap-4">
      <Link
        href="/bookings"
        className="flex items-center gap-1 self-start text-xs font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t("back")}
      </Link>
      {booking.isPending ? (
        <Panel aria-busy="true" className="h-40" />
      ) : booking.isError ? (
        <ApiErrorState error={booking.error} onRetry={() => booking.refetch()} />
      ) : booking.data === null ? (
        <Panel>
          <PageHeader title={t("notFoundTitle")} />
          <p className="text-sm">{t("notFoundText")}</p>
        </Panel>
      ) : (
        <BookingBody booking={booking.data} refetch={() => booking.refetch()} />
      )}
    </section>
  );
}

type Step = "accept" | "decline" | "withdraw" | "cancel";

function BookingBody({ booking, refetch }: { booking: Booking; refetch: () => void }) {
  const t = useTranslations();
  const term = useTermText();
  const amount = useAmountText();
  const expires = useExpiresText();
  const queryClient = useQueryClient();
  const side = otherSide(booking);
  const [counter, setCounter] = useState(false);
  const [reason, setReason] = useState<"decline" | "cancel" | null>(null);
  const [conflict, setConflict] = useState(false);
  const cancellable = booking.status === "ACCEPTED" && new Date(booking.startsAt) > new Date();

  async function stored(next: Booking, done: string, calendar = false) {
    queryClient.setQueryData([...BOOKINGS, "one", next.id], next);
    toast.success(done);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BOOKINGS }),
      // Accepting and cancelling change the calendar, and acceptance fills the listing it answers.
      ...(calendar
        ? [
            queryClient.invalidateQueries({ queryKey: AVAILABILITY }),
            queryClient.invalidateQueries({ queryKey: LISTINGS }),
          ]
        : []),
    ]);
  }

  const step = useMutation({
    // Stale offers and calendar conflicts get their own messages; the rest are toasted below.
    meta: { handlesErrors: true },
    mutationFn: async ({ kind, text }: { kind: Step; text?: string }) => {
      const path = { params: { path: { id: booking.id } } };
      switch (kind) {
        case "accept":
          return unwrap(await api.POST("/api/v1/bookings/{id}/accept", { ...path, body: { revision: booking.revision } }));
        case "decline":
          return unwrap(
            await api.POST("/api/v1/bookings/{id}/decline", { ...path, body: text ? { reason: text } : {} }),
          );
        case "withdraw":
          return unwrap(await api.POST("/api/v1/bookings/{id}/withdraw", path));
        case "cancel":
          return unwrap(await api.POST("/api/v1/bookings/{id}/cancel", { ...path, body: { reason: text ?? "" } }));
      }
    },
    onSuccess: (next, { kind }) => {
      setReason(null);
      setConflict(false);
      const done = {
        accept: t("bookings.detail.accepted"),
        decline: t("bookings.detail.declined"),
        withdraw: t("bookings.detail.withdrawn"),
        cancel: t("bookings.detail.cancelled"),
      }[kind];
      return stored(next, done, kind === "accept" || kind === "cancel");
    },
    onError: (failure) => {
      const problem = toApiProblem(failure);
      if (problem.code === "BOOKING_STALE") {
        toast.error(t("bookings.detail.stale"));
        refetch();
      } else if (problem.code === "BOOKING_CALENDAR_CONFLICT" && booking.myParty === "ARTIST") {
        setConflict(true);
      } else {
        toast.error(problem.detail || problem.title || fallbackMessage(t, problem));
        if (problem.status === 409) refetch();
      }
    },
  });

  const when = term(booking.startsAt, booking.endsAt);
  return (
    <>
      <PageHeader title={side.name} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <Panel title={t("bookings.detail.terms")} headingLevel={2}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="border-2 border-border bg-highlight px-3 py-2 text-base font-bold tabular-nums text-highlight-foreground">
              <span className="sr-only">{t("bookings.detail.term")}: </span>
              {when}
            </p>
            <StatusTag booking={booking} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-bold uppercase text-muted-foreground">{t("bookings.detail.amount")}</dt>
            <dd>{amount(booking.amount)}</dd>
            {booking.message && (
              <>
                <dt className="font-bold uppercase text-muted-foreground">{t("bookings.detail.message")}</dt>
                <dd className="whitespace-pre-line break-words">{booking.message}</dd>
              </>
            )}
          </dl>
          {booking.respondBy != null && (
            <p className="text-sm">
              {booking.myTurn
                ? t("bookings.detail.decide", { when: expires(booking.respondBy) })
                : t("bookings.detail.waiting", { when: expires(booking.respondBy) })}
            </p>
          )}
          {conflict && (
            <div role="alert" className="flex flex-col items-start gap-2 border-2 border-danger p-3">
              <p className="flex items-start gap-1.5 text-sm text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t("bookings.detail.conflict")}</span>
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/calendar?day=${local(booking.startsAt).day}`}>{t("bookings.detail.goCalendar")}</Link>
              </Button>
            </div>
          )}
          {(booking.myTurn || booking.canWithdraw || cancellable) && (
            <div className="flex flex-wrap gap-2">
              {booking.myTurn && (
                <>
                  <Button
                    type="button"
                    disabled={step.isPending}
                    onClick={() => step.mutate({ kind: "accept" })}
                  >
                    {t("bookings.detail.accept")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCounter(true)}>
                    {t("bookings.detail.counter")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setReason("decline")}>
                    {t("bookings.detail.decline")}
                  </Button>
                </>
              )}
              {booking.canWithdraw && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={step.isPending}
                  onClick={() => {
                    if (window.confirm(t("bookings.detail.withdrawConfirm"))) step.mutate({ kind: "withdraw" });
                  }}
                >
                  {t("bookings.detail.withdraw")}
                </Button>
              )}
              {cancellable && (
                <Button type="button" variant="destructive" onClick={() => setReason("cancel")}>
                  {t("bookings.detail.cancel")}
                </Button>
              )}
            </div>
          )}
        </Panel>
        <Panel
          title={booking.myParty === "ARTIST" ? t("bookings.detail.venue") : t("bookings.detail.artist")}
          headingLevel={2}
        >
          <p className="font-display text-xl leading-tight">{side.name}</p>
          {side.href && (
            <Button asChild variant="outline" className="self-start">
              <Link href={side.href}>{t("bookings.detail.seeProfile")}</Link>
            </Button>
          )}
        </Panel>
      </div>
      <History steps={booking.steps} />
      <CounterDialog
        booking={booking}
        open={counter}
        onClose={() => setCounter(false)}
        onDone={(next) => {
          setCounter(false);
          void stored(next, t("bookings.detail.countered"));
        }}
      />
      <ReasonDialog
        mode={reason}
        busy={step.isPending}
        onClose={() => setReason(null)}
        onConfirm={(text) => step.mutate({ kind: reason!, text })}
      />
    </>
  );
}

/** Every step, newest first; proposals show their terms, answers their message. */
function History({ steps }: { steps: BookingStep[] }) {
  const t = useTranslations("bookings");
  const format = useFormatter();
  const term = useTermText();
  const amount = useAmountText();
  return (
    <Panel title={t("detail.history")} headingLevel={2}>
      <ol className="flex flex-col gap-3">
        {[...steps].reverse().map((step) => {
          const proposal = step.type === "REQUESTED" || step.type === "COUNTERED";
          return (
            <li
              key={`${step.at}-${step.type}`}
              data-step={step.type}
              className="flex flex-col gap-1 border-l-4 border-border pl-3 text-sm"
            >
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold uppercase">{t(`steps.${step.type}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {step.mine ? t("detail.you") : t(`party.${step.party}`)} ·{" "}
                  <time dateTime={step.at}>
                    {format.dateTime(new Date(step.at), { dateStyle: "medium", timeStyle: "short", timeZone: ZONE })}
                  </time>
                </span>
              </p>
              {proposal && (
                <p className="tabular-nums">
                  {term(step.startsAt, step.endsAt)} · {amount(step.amount)}
                </p>
              )}
              {step.message && <p className="whitespace-pre-line break-words">{step.message}</p>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
