"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormRootError,
  Label,
  Textarea,
  translateFormError,
} from "@spot-on-slot/ui";
import { showServerError } from "@/components/auth/server-error";
import { api } from "@/lib/api";
import { BookingFields } from "./booking-fields";
import { bookingSchema, toTerms, toValues, type BookingValues } from "./booking-form-values";
import type { Booking } from "./queries";

const MAX_REASON = 500;

/** New terms for a booking; the turn passes to the other side. */
export function CounterDialog({
  booking,
  open,
  onClose,
  onDone,
}: {
  booking: Booking;
  open: boolean;
  onClose: () => void;
  onDone: (booking: Booking) => void;
}) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <DialogContent
          closeLabel={t("common.close")}
          className="max-h-[90vh] overflow-y-auto rounded-none border-2 border-border"
        >
          <DialogHeader>
            <DialogTitle className="uppercase">{t("bookings.counterDialog.title")}</DialogTitle>
            <DialogDescription>{t("bookings.counterDialog.hint")}</DialogDescription>
          </DialogHeader>
          <CounterForm booking={booking} onDone={onDone} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function CounterForm({ booking, onDone }: { booking: Booking; onDone: (booking: Booking) => void }) {
  const t = useTranslations();
  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema()),
    defaultValues: toValues(booking, booking.amount),
  });

  async function onSubmit(values: BookingValues) {
    try {
      onDone(
        unwrap(
          await api.POST("/api/v1/bookings/{id}/counter", {
            params: { path: { id: booking.id } },
            body: toTerms(values),
          }),
        ),
      );
    } catch (failure) {
      showServerError(form, toApiProblem(failure), t);
    }
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <BookingFields form={form} />
        <FormRootError />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("bookings.new.sending") : t("bookings.counterDialog.send")}
        </Button>
      </form>
    </Form>
  );
}

/** Declining (reason optional) or cancelling an accepted booking (reason required). */
export function ReasonDialog({
  mode,
  onClose,
  onConfirm,
  busy,
}: {
  mode: "decline" | "cancel" | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const t = useTranslations();
  return (
    <Dialog open={mode !== null} onOpenChange={(next) => !next && onClose()}>
      {mode && (
        <DialogContent closeLabel={t("common.close")} className="rounded-none border-2 border-border">
          <ReasonForm key={mode} mode={mode} onClose={onClose} onConfirm={onConfirm} busy={busy} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReasonForm({
  mode,
  onClose,
  onConfirm,
  busy,
}: {
  mode: "decline" | "cancel";
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const t = useTranslations();
  const id = useId();
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);
  const cancel = mode === "cancel";

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (cancel && reason.trim() === "") {
          setMissing(true);
          return;
        }
        onConfirm(reason.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle className="uppercase">
          {cancel ? t("bookings.reason.cancelTitle") : t("bookings.reason.declineTitle")}
        </DialogTitle>
        <DialogDescription>{cancel ? t("bookings.reason.cancelHint") : t("bookings.reason.declineHint")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{t("bookings.reason.label")}</Label>
        <Textarea
          id={id}
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          required={cancel}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? `${id}-error` : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            setMissing(false);
          }}
        />
        {missing && (
          <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("validation.required")}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={cancel ? "destructive" : "default"} disabled={busy}>
          {cancel ? t("bookings.reason.confirmCancel") : t("bookings.reason.confirmDecline")}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("bookings.reason.keep")}
        </Button>
      </div>
    </form>
  );
}
