"use client";

import { useTranslations } from "next-intl";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@spot-on-slot/ui";
import { AuthField } from "@/components/auth/auth-field";
import { today } from "@/components/calendar/warsaw-time";
import { endsNextDay } from "@/components/listings/listing-form-values";
import { MAX_MESSAGE, type BookingValues } from "./booking-form-values";

/**
 * Date and hours (left out when the time is fixed), the fee in zł and the message. An end at or before the start
 * means the next day.
 */
export function BookingFields({
  form,
  time = true,
  placeholder,
}: {
  form: UseFormReturn<BookingValues>;
  time?: boolean;
  placeholder?: string;
}) {
  const t = useTranslations("bookings.new");
  const [message, from, to] = useWatch({ control: form.control, name: ["message", "from", "to"] });

  return (
    <>
      {time && (
        <>
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("date")}</FormLabel>
                <FormControl>
                  <Input type="date" min={today()} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            {(["from", "to"] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{name === "from" ? t("from") : t("to2")}</FormLabel>
                    <FormControl>
                      <Input type="time" step={300} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          {endsNextDay(from, to) && (
            <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
              {t("nextDay")}
            </p>
          )}
        </>
      )}
      <AuthField
        control={form.control}
        name="amount"
        label={t("amount")}
        description={t("amountHint")}
        inputMode="numeric"
      />
      <FormField
        control={form.control}
        name="message"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("message")}</FormLabel>
            <FormControl>
              <Textarea rows={4} maxLength={MAX_MESSAGE} placeholder={placeholder} {...field} />
            </FormControl>
            <FormDescription>{t("count", { count: message.length, max: MAX_MESSAGE })}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
