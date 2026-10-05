"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  translateFormError,
} from "@spot-on-slot/ui";
import { api } from "@/lib/api";
import { getPrivacyConfig } from "@/lib/privacy-config";
import { AuthCard, authLinkClass } from "./auth-card";
import { AuthField } from "./auth-field";
import { registerSchema, type RegisterRole, type RegisterValues } from "./auth-schemas";
import { CheckEmail } from "./check-email";
import { showServerError } from "./server-error";

export function RegisterForm({ role }: { role: RegisterRole }) {
  const t = useTranslations();
  const locale = useLocale();
  const privacy = getPrivacyConfig();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", passwordRepeat: "", privacyNoticeAccepted: false },
  });

  async function onSubmit(values: RegisterValues) {
    try {
      unwrap(
        await api.POST("/api/v1/auth/register", {
          body: {
            email: values.email,
            password: values.password,
            role,
            locale,
            privacyNoticeAccepted: values.privacyNoticeAccepted,
          },
        }),
      );
      setSentTo(values.email);
    } catch (error) {
      showServerError(form, toApiProblem(error), t);
    }
  }

  if (sentTo) {
    return (
      <AuthCard title={t("auth.checkEmail.title")}>
        <CheckEmail email={sentTo} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("auth.register.title")}
      footer={
        <p>
          {t("auth.register.hasAccount")}{" "}
          <Link href="/login" className={authLinkClass}>
            {t("auth.register.login")}
          </Link>
        </p>
      }
    >
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase">
        <span className="font-display text-sm">{t("auth.register.asRole", { role: t(`auth.register.roles.${role}`) })}</span>
        <Link href="/register" className={authLinkClass}>
          {t("auth.register.changeRole")}
        </Link>
      </p>
      <Form {...form} translateError={translateFormError(t as Parameters<typeof translateFormError>[0])}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <AuthField control={form.control} name="email" label={t("auth.fields.email")} type="email" autoComplete="email" />
          <AuthField
            control={form.control}
            name="password"
            label={t("auth.fields.password")}
            description={t("auth.fields.passwordHint")}
            type="password"
            autoComplete="new-password"
          />
          <AuthField
            control={form.control}
            name="passwordRepeat"
            label={t("auth.fields.passwordRepeat")}
            type="password"
            autoComplete="new-password"
          />
          <FormField
            control={form.control}
            name="privacyNoticeAccepted"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className="mt-0.5 size-5 rounded-none border-2"
                    />
                  </FormControl>
                  <FormLabel className="leading-snug">{t("auth.register.privacyAccept")}</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("auth.register.privacyClause", { administrator: privacy.controller, contact: privacy.email })}
          </p>
          <FormRootError />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("auth.register.submit")}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
