"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useForm, type Control } from "react-hook-form";
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
import { getLegalLinks } from "@/lib/legal-links";
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
  const legal = getLegalLinks(locale);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", passwordRepeat: "", acceptTerms: false, privacyNoticeAccepted: false },
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
            acceptTerms: values.acceptTerms,
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
          <ConsentField
            control={form.control}
            name="acceptTerms"
            label={t.rich("auth.register.termsAccept", {
              terms: (chunks) => (
                <a href={legal.terms} target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                  {chunks}
                </a>
              ),
              privacy: (chunks) => (
                <a href={legal.privacy} target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                  {chunks}
                </a>
              ),
            })}
          />
          <ConsentField control={form.control} name="privacyNoticeAccepted" label={t("auth.register.privacyAccept")} />
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

function ConsentField({
  control,
  name,
  label,
}: {
  control: Control<RegisterValues>;
  name: "acceptTerms" | "privacyNoticeAccepted";
  label: ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name}
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
            <FormLabel className="leading-snug">{label}</FormLabel>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
