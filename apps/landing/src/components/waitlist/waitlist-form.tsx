"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import {
  applyServerErrors,
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  translateFormError,
} from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { WAITLIST_ROLES, waitlistSchema, type WaitlistValues } from "./waitlist-schema";

export function WaitlistForm() {
  const t = useTranslations();
  const locale = useLocale();
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  const form = useForm<WaitlistValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { email: "", role: undefined, city: "", consent: false, website: "" },
  });

  async function onSubmit(values: WaitlistValues) {
    try {
      unwrap(await api.POST("/api/v1/waitlist/signups", { body: { ...values, locale } }));
    } catch (error) {
      const problem = toApiProblem(error);
      // Field errors go under their fields; anything else (network, server, rate limit) gets the generic text.
      if (problem.errors?.length) applyServerErrors(form, problem);
      else form.setError("root.server", { type: "server", message: t("waitlist.error") });
      return;
    }
    setSignedUpEmail(values.email);
  }

  if (signedUpEmail) {
    return (
      <div role="status" className="border-2 border-border bg-card p-6 text-foreground shadow-md">
        <p>
          <strong className="font-semibold">{t("waitlist.successTitle")}</strong>{" "}
          {t("waitlist.successText", { email: signedUpEmail })}
        </p>
      </div>
    );
  }

  return (
    <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative grid gap-6" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("waitlist.emailLabel")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("waitlist.roleLabel")}</FormLabel>
              <Select name={field.name} value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger ref={field.ref} onBlur={field.onBlur} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WAITLIST_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`waitlist.roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("waitlist.cityLabel")}</FormLabel>
              <FormControl>
                <Input autoComplete="address-level2" maxLength={100} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    ref={field.ref}
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    className="mt-0.5"
                  />
                </FormControl>
                <FormLabel className="text-sm leading-snug font-normal">{t("waitlist.consentLabel")}</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <input
          {...form.register("website")}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-px w-px opacity-0"
        />
        <FormRootError />
        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("waitlist.submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
